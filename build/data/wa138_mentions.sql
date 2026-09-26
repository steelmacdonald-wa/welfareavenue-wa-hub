-- wave138 (26/09/26): @mentions anywhere in the Hub send a Slack DM, from the person who wrote them.
-- Steel: "I want the ability to @ someone anywhere in the hub and it will send them a direct message from me in
-- Slack - no asking this is done automatically. I'd like the same capabilities for everyone at the charity. So if
-- Ian comments @joy on a content task on slack Ian will have sent her a message of the comment and link to the
-- task on the hub"
-- When someone saves text with @Name (a roster name) in a task comment or description, a goal comment, a request
-- note, a team update, a decision, a committee note, a project description or a Content calendar post, a row goes
-- in hub_mentions and notify sends the DM: as the writer when they have connected Slack (slack-connect), else from
-- the Hub bot with their name. Only new mentions count when text is edited; AI-written text mentions nobody.

-- 1. who has connected Slack (the token itself is in the vault, as slack_user_token:<email>)
create table if not exists public.slack_links (
  email text primary key,
  slack_user_id text not null,
  slack_team_id text,
  scopes text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.slack_links enable row level security;
drop policy if exists slack_links_read on public.slack_links;
create policy slack_links_read on public.slack_links for select to authenticated using (email = public.wa_email() or public.is_hub_admin());
revoke all on public.slack_links from anon, authenticated;
grant select on public.slack_links to authenticated;
comment on table public.slack_links is 'People who connected their Slack account to the Hub (slack-connect), so their @mentions are sent as them. The user token is in the vault as slack_user_token:<email>, never in this table. People read their own row; admins read all; only the service role writes.';
comment on column public.slack_links.email is 'Hub email (lower case) of the person.';
comment on column public.slack_links.slack_user_id is 'Their Slack user id, checked against their Hub email when they connected.';
comment on column public.slack_links.scopes is 'User token scopes granted (chat:write, im:write).';

create or replace function public.slack_link_save(p_email text, p_user_id text, p_team_id text, p_scopes text, p_token text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v_name text := 'slack_user_token:' || lower(trim(p_email)); v_id uuid;
begin
  if coalesce(trim(p_email), '') = '' or coalesce(trim(p_token), '') = '' then raise exception 'email and token needed'; end if;
  select id into v_id from vault.secrets where name = v_name;
  if v_id is null then perform vault.create_secret(p_token, v_name, 'Slack user token for Hub @mentions (slack-connect)');
  else perform vault.update_secret(v_id, p_token); end if;
  insert into public.slack_links (email, slack_user_id, slack_team_id, scopes, connected_at, updated_at)
  values (lower(trim(p_email)), p_user_id, p_team_id, p_scopes, now(), now())
  on conflict (email) do update set slack_user_id = excluded.slack_user_id, slack_team_id = excluded.slack_team_id, scopes = excluded.scopes, updated_at = now();
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('slack_link', lower(trim(p_email)), 'connected', null, 'Slack connected for @mentions', lower(trim(p_email)));
end $$;
revoke all on function public.slack_link_save(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.slack_link_save(text, text, text, text, text) to service_role;
comment on function public.slack_link_save(text, text, text, text, text) is 'slack-connect stores a person''s Slack user token in the vault (slack_user_token:<email>) and records the link in slack_links. Logged. Access: service role only.';

create or replace function public.slack_link_drop(p_email text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v_name text := 'slack_user_token:' || lower(trim(p_email));
begin
  delete from vault.secrets where name = v_name;
  delete from public.slack_links where email = lower(trim(p_email));
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('slack_link', lower(trim(p_email)), 'disconnected', 'Slack connected', null, lower(trim(p_email)));
end $$;
revoke all on function public.slack_link_drop(text) from public, anon, authenticated;
grant execute on function public.slack_link_drop(text) to service_role;
comment on function public.slack_link_drop(text) is 'slack-connect removes a person''s Slack token and link (Disconnect). Logged. Access: service role only.';

-- 2. every mention, and whether its DM went out
create table if not exists public.hub_mentions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  from_email text not null,
  from_name text,
  to_member_id bigint references public.team_members(id) on update cascade on delete set null,
  to_name text,
  to_email text,
  kind text not null check (kind in ('task', 'goal', 'request', 'update', 'decision', 'committee', 'project', 'content')),
  ref_id bigint,
  ref_title text,
  snippet text,
  url text,
  private boolean not null default false,
  source_table text,
  source_id bigint,
  dm_status text not null default 'pending' check (dm_status in ('pending', 'sent', 'skipped', 'failed')),
  dm_via text check (dm_via in ('user', 'bot')),
  dm_error text,
  dm_at timestamptz,
  seen boolean not null default false
);
create index if not exists idx_hub_mentions_to_email on public.hub_mentions (to_email, created_at desc);
create index if not exists idx_hub_mentions_to_member_id on public.hub_mentions (to_member_id);
create index if not exists idx_hub_mentions_from_email on public.hub_mentions (from_email, created_at desc);
alter table public.hub_mentions enable row level security;
drop policy if exists hub_mentions_read on public.hub_mentions;
create policy hub_mentions_read on public.hub_mentions for select to authenticated
  using (to_email = public.wa_email() or from_email = public.wa_email() or public.is_hub_admin());
revoke all on public.hub_mentions from anon, authenticated;
grant select on public.hub_mentions to authenticated;
comment on table public.hub_mentions is 'Every @mention people write in the Hub (task comments and descriptions, goal comments, request notes, team updates, decisions, committee notes, project descriptions, Content calendar posts), who wrote it, who it names and whether the Slack DM went out (notify, event comment_mention). Written only by the mention triggers (wa_mention_notify); people read the mentions they wrote or received, admins all.';
comment on column public.hub_mentions.kind is 'Where the mention was written: task, goal, request, update, decision, committee, project or content.';
comment on column public.hub_mentions.url is 'The Hub address of what was commented on (such as #task/123), linked in the DM.';
comment on column public.hub_mentions.private is 'True when the item is confidential, board only or restricted: the DM names the item kind and links to it, without the text.';
comment on column public.hub_mentions.dm_status is 'pending, sent, skipped (no Slack account, opted out, or no longer active) or failed (dm_error says why).';
comment on column public.hub_mentions.dm_via is 'user: sent as the writer (they connected Slack); bot: from the Hub bot with their name.';

-- 3. who a text mentions: for each @, the longest active roster name that follows it, ending on a word boundary
create or replace function public.wa_mentioned_members(p_text text)
returns table (member_id bigint, member_name text, member_email text)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare v_pos int; v_rest text; v_id bigint; v_name text; v_email text; v_seen bigint[] := '{}';
begin
  if p_text is null or position('@' in p_text) = 0 then return; end if;
  for v_pos in select s.i from generate_series(1, least(length(p_text), 8000)) s(i) where substr(p_text, s.i, 1) = '@' loop
    if v_pos > 1 and substr(p_text, v_pos - 1, 1) ~ '[[:alnum:]_.]' then continue; end if;   -- an email address, not a mention
    v_rest := lower(substr(p_text, v_pos + 1, 60));
    v_id := null;
    select m.id, m.name, lower(m.email) into v_id, v_name, v_email
      from public.team_members m
      where m.active is not false and coalesce(trim(m.name), '') <> ''
        and left(v_rest, length(m.name)) = lower(m.name)
        and (length(v_rest) = length(m.name) or (substr(v_rest, length(m.name) + 1, 1) !~ '[[:alnum:]_]'
             and not (substr(v_rest, length(m.name) + 1, 1) = '.' and substr(v_rest, length(m.name) + 2, 1) ~ '[[:alnum:]_]')))   -- @joy.dumansi is a handle
      order by length(m.name) desc, m.id limit 1;
    if v_id is not null and not (v_id = any(v_seen)) then
      v_seen := v_seen || v_id;
      member_id := v_id; member_name := v_name; member_email := v_email;
      return next;
    end if;
  end loop;
end $$;
revoke all on function public.wa_mentioned_members(text) from public, anon;
grant execute on function public.wa_mentioned_members(text) to authenticated, service_role;
comment on function public.wa_mentioned_members(text) is 'The active roster members a text @mentions: after each @ (not part of an email address), the longest team_members.name that follows, ending on a word boundary (not @joy.dumansi, which is a handle), case-insensitive; each person once. Used by the mention triggers and the page. Access: authenticated.';

-- 4. file the new mentions of a text (only those not already in p_old), as the signed-in writer
create or replace function public.wa_mention_notify(p_new text, p_old text, p_kind text, p_ref_id bigint, p_ref_title text, p_url text, p_private boolean, p_source_table text, p_source_id bigint)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare v_from text := public.wa_email(); v_from_name text; r record; v_n int := 0; v_snip text; v_txt text; v_p int;
begin
  if v_from = '' or p_new is null or position('@' in p_new) = 0 then return 0; end if;   -- AI and jobs mention nobody
  select name into v_from_name from public.team_members where lower(email) = v_from and active is not false order by id limit 1;
  v_txt := regexp_replace(regexp_replace(trim(p_new), '[ \t]+', ' ', 'g'), '\n{3,}', E'\n\n', 'g');
  for r in select * from public.wa_mentioned_members(p_new) loop
    if r.member_email = v_from then continue; end if;
    if p_old is not null and exists (select 1 from public.wa_mentioned_members(p_old) o where o.member_id = r.member_id) then continue; end if;
    -- the DM quotes the whole text when it is short, else the 600 characters around the mention
    v_p := position(lower('@' || r.member_name) in lower(v_txt));
    v_snip := case when length(v_txt) <= 600 then v_txt
                   when v_p <= 400 then left(v_txt, 597) || '...'
                   else '...' || substr(v_txt, v_p - 200, 594) || case when v_p - 200 + 594 <= length(v_txt) then '...' else '' end end;
    insert into public.hub_mentions (from_email, from_name, to_member_id, to_name, to_email, kind, ref_id, ref_title, snippet, url, private, source_table, source_id)
    values (v_from, coalesce(v_from_name, v_from), r.member_id, r.member_name, r.member_email, p_kind, p_ref_id, left(coalesce(p_ref_title, ''), 200), v_snip, p_url, coalesce(p_private, false), p_source_table, p_source_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.wa_mention_notify(text, text, text, bigint, text, text, boolean, text, bigint) from public, anon, authenticated;
comment on function public.wa_mention_notify(text, text, text, bigint, text, text, boolean, text, bigint) is 'Called by the mention triggers: files a hub_mentions row for each person the new text @mentions who was not already mentioned in the old text, as the signed-in writer (nobody when the writer is a job or the AI). Access: triggers only.';

-- 5. a new mention sends its DM (notify, comment_mention)
create or replace function public.trg_hub_mention_dm()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform public.call_edge('notify', jsonb_build_object('event', 'comment_mention', 'mention_id', new.id));
  return new;
exception when others then
  return new;
end $$;
revoke all on function public.trg_hub_mention_dm() from public, anon, authenticated;
drop trigger if exists hub_mentions_dm on public.hub_mentions;
create trigger hub_mentions_dm after insert on public.hub_mentions for each row execute function public.trg_hub_mention_dm();
comment on function public.trg_hub_mention_dm() is 'Trigger on hub_mentions insert: asks notify (event comment_mention) to send the Slack DM. Access: trigger only.';

-- 6. the triggers on every place people write
create or replace function public.trg_mentions_task_comment()
returns trigger language plpgsql security definer set search_path to '' as $$
declare t record;
begin
  if coalesce(new.source, 'manual') not in ('manual', '') then return new; end if;
  select title, coalesce(board_only, false) or coalesce(confidential, false) or coalesce(visibility, '') in ('leadership', 'private') as priv into t from public.dept_tasks where id = new.task_id;
  perform public.wa_mention_notify(new.body, null, 'task', new.task_id, t.title, '#task/' || new.task_id, coalesce(t.priv, false), 'task_comments', new.id);
  return new;
end $$;
drop trigger if exists task_comments_mentions on public.task_comments;
create trigger task_comments_mentions after insert on public.task_comments for each row execute function public.trg_mentions_task_comment();

create or replace function public.trg_mentions_task()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.description is null or position('@' in new.description) = 0 then return new; end if;
  if tg_op = 'UPDATE' and new.description is not distinct from old.description then return new; end if;
  perform public.wa_mention_notify(new.description, case when tg_op = 'UPDATE' then old.description end, 'task', new.id, new.title, '#task/' || new.id,
    coalesce(new.board_only, false) or coalesce(new.confidential, false) or coalesce(new.visibility, '') in ('leadership', 'private'), 'dept_tasks', new.id);
  return new;
end $$;
drop trigger if exists dept_tasks_mentions on public.dept_tasks;
create trigger dept_tasks_mentions after insert or update of description on public.dept_tasks for each row execute function public.trg_mentions_task();

create or replace function public.trg_mentions_goal_comment()
returns trigger language plpgsql security definer set search_path to '' as $$
declare g record;
begin
  if tg_op = 'UPDATE' and new.body is not distinct from old.body then return new; end if;
  select title, department into g from public.goals where id = new.goal_id;
  perform public.wa_mention_notify(new.body, case when tg_op = 'UPDATE' then old.body end, 'goal', new.goal_id, g.title, '#goals', false, 'goal_comments', new.id);
  return new;
end $$;
drop trigger if exists goal_comments_mentions on public.goal_comments;
create trigger goal_comments_mentions after insert or update of body on public.goal_comments for each row execute function public.trg_mentions_goal_comment();

create or replace function public.trg_mentions_request_note()
returns trigger language plpgsql security definer set search_path to '' as $$
declare q record;
begin
  select title into q from public.dept_requests where id = new.request_id;
  perform public.wa_mention_notify(new.body, null, 'request', new.request_id, q.title, '#requests/r/' || new.request_id, false, 'request_notes', new.id);
  return new;
end $$;
drop trigger if exists request_notes_mentions on public.request_notes;
create trigger request_notes_mentions after insert on public.request_notes for each row execute function public.trg_mentions_request_note();

create or replace function public.trg_mentions_update()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  perform public.wa_mention_notify(new.text, null, 'update', new.id, coalesce(new.entry_label, 'a team update'), '#team/' || coalesce(new.department, ''),
    coalesce(new.board_only, false) or coalesce(new.confidential, false) or coalesce(new.visibility, '') in ('leadership', 'private'), 'dept_updates', new.id);
  return new;
end $$;
drop trigger if exists dept_updates_mentions on public.dept_updates;
create trigger dept_updates_mentions after insert on public.dept_updates for each row execute function public.trg_mentions_update();

create or replace function public.trg_mentions_decision()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_new text := concat_ws(E'\n', new.suggested_move, new.decided_note); v_old text;
begin
  if tg_op = 'UPDATE' then v_old := concat_ws(E'\n', old.suggested_move, old.decided_note); if v_new is not distinct from v_old then return new; end if; end if;
  perform public.wa_mention_notify(v_new, v_old, 'decision', new.id, new.title, '#decision/' || new.id,
    coalesce(new.board_only, false) or coalesce(new.confidential, false) or coalesce(new.visibility, '') in ('leadership', 'private'), 'decisions', new.id);
  return new;
end $$;
drop trigger if exists decisions_mentions on public.decisions;
create trigger decisions_mentions after insert or update of suggested_move, decided_note on public.decisions for each row execute function public.trg_mentions_decision();

create or replace function public.trg_mentions_touchpoint()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_new text := concat_ws(E'\n', new.summary, new.recommendation); v_old text;
begin
  if tg_op = 'UPDATE' then v_old := concat_ws(E'\n', old.summary, old.recommendation); if v_new is not distinct from v_old then return new; end if; end if;
  perform public.wa_mention_notify(v_new, v_old, 'committee', new.id, coalesce(new.committee, 'a committee') || ' committee', '#committees', true, 'board_touchpoints', new.id);
  return new;
end $$;
drop trigger if exists board_touchpoints_mentions on public.board_touchpoints;
create trigger board_touchpoints_mentions after insert or update of summary, recommendation on public.board_touchpoints for each row execute function public.trg_mentions_touchpoint();

create or replace function public.trg_mentions_project()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.description is null or position('@' in new.description) = 0 then return new; end if;
  if tg_op = 'UPDATE' and new.description is not distinct from old.description then return new; end if;
  perform public.wa_mention_notify(new.description, case when tg_op = 'UPDATE' then old.description end, 'project', new.id, new.name, '#project/' || new.id, false, 'projects', new.id);
  return new;
end $$;
drop trigger if exists projects_mentions on public.projects;
create trigger projects_mentions after insert or update of description on public.projects for each row execute function public.trg_mentions_project();

create or replace function public.trg_mentions_content()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_new text := new.notes; v_old text;   -- the notes for the team, not the caption (captions tag Instagram accounts)
begin
  if tg_op = 'UPDATE' then v_old := old.notes; if v_new is not distinct from v_old then return new; end if; end if;
  perform public.wa_mention_notify(v_new, v_old, 'content', new.id, coalesce(nullif(new.title, ''), 'a post'), '#contentcal/' || new.id, false, 'content_posts', new.id);
  return new;
end $$;
drop trigger if exists content_posts_mentions on public.content_posts;
create trigger content_posts_mentions after insert or update of notes on public.content_posts for each row execute function public.trg_mentions_content();

do $$
declare f text;
begin
  foreach f in array array['trg_mentions_task_comment', 'trg_mentions_task', 'trg_mentions_goal_comment', 'trg_mentions_request_note', 'trg_mentions_update',
                           'trg_mentions_decision', 'trg_mentions_touchpoint', 'trg_mentions_project', 'trg_mentions_content'] loop
    execute format('revoke all on function public.%I() from public, anon, authenticated', f);
    execute format('comment on function public.%I() is %L', f, 'Mention trigger (wave138): files new @mentions of what was written through wa_mention_notify(). Access: trigger only.');
  end loop;
end $$;

-- 7. the person mentioned marks it seen (Home)
create or replace function public.mention_seen(p_ids bigint[])
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare v_n int;
begin
  update public.hub_mentions set seen = true where id = any(p_ids) and to_email = public.wa_email() and not seen;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.mention_seen(bigint[]) from public, anon;
grant execute on function public.mention_seen(bigint[]) to authenticated;
comment on function public.mention_seen(bigint[]) is 'Marks the caller''s own mentions seen (Home). Access: authenticated.';

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values
  ('hub', 'wave138', '@mentions', null, '@mentions anywhere in the Hub send a Slack DM (as the writer once they connect Slack, else from the Hub bot)', 'Hub release (wave138)');
