-- wave205b (04/10/26): the last two guards of the permission model, kept apart because the Supabase connector holds any
-- statement with this keyword for Steel's approval. Without them, any staff account could still remove an organizational
-- goal or someone else's goal comment straight through the database API (the page never offers either).
create policy goals_wa205_remove on public.goals as restrictive for delete to authenticated using (public.is_hub_admin());
create policy goal_comments_wa205_remove on public.goal_comments as restrictive for delete to authenticated
  using (author_email = public.wa_email() or public.is_hub_admin() or (author_email is null and public.wa205_can_comment()));
comment on policy goals_wa205_remove on public.goals is 'wave205: only admins remove a goal row (goals are retired, never removed; see retired_at).';
comment on policy goal_comments_wa205_remove on public.goal_comments is 'wave205: a goal comment is removed only by its author or an admin (older rows without author_email: staff who may comment).';
