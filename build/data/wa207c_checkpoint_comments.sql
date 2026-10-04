-- wave207 (04/10/26): comments on a quarterly checkpoint, like comments on a milestone (threaded, @mentions through the
-- existing goal_comments trigger and wave138's notify; nothing new sends).
alter table public.goal_comments add column if not exists checkpoint_id bigint references public.goal_checkpoints(id);
create index if not exists goal_comments_checkpoint_id_idx on public.goal_comments(checkpoint_id);
comment on column public.goal_comments.checkpoint_id is 'wave207: the quarterly checkpoint the thread is about (goal_checkpoints), or null. Set through strategy_checkpoint_comment_add().';

create or replace function public.strategy_checkpoint_comment_add(p_checkpoint bigint, p_parent bigint, p_body text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_id bigint; v_goal bigint; v_body text := btrim(coalesce(p_body, ''));
begin
  if not public.wa205_can_comment() then raise exception 'Board viewers read the goals; staff comment on them.'; end if;
  if v_body = '' then raise exception 'Write something first.'; end if;
  if length(v_body) > 4000 then raise exception 'Keep a comment under 4,000 characters.'; end if;
  select c.goal_id into v_goal from public.goal_checkpoints c join public.goals g on g.id = c.goal_id where c.id = p_checkpoint and g.department = 'org';
  if v_goal is null then raise exception 'Comment on a checkpoint of one of the organizational goals.'; end if;
  if p_parent is not null and not exists (select 1 from public.goal_comments x where x.id = p_parent and x.goal_id = v_goal) then raise exception 'That thread belongs to another goal.'; end if;
  insert into public.goal_comments (goal_id, body, author, author_email, parent_id, checkpoint_id, created_at, updated_at)
  values (v_goal, v_body, public.wa205_name(public.wa_email()), public.wa_email(), p_parent, p_checkpoint, now(), now())
  returning id into v_id;
  return (select to_jsonb(x) from public.goal_comments x where x.id = v_id);
end $$;
comment on function public.strategy_checkpoint_comment_add(bigint, bigint, text) is 'wave207: a comment on a quarterly checkpoint of an organizational goal, or an answer in its thread (p_parent). @mentions go through the existing goal_comments trigger (hub_mentions, wave138''s Slack DM, Steel''s choice of 26/09/26). Checks inside: staff who may comment (not viewers). Access: authenticated.';
revoke all on function public.strategy_checkpoint_comment_add(bigint, bigint, text) from public, anon;
grant execute on function public.strategy_checkpoint_comment_add(bigint, bigint, text) to authenticated;
