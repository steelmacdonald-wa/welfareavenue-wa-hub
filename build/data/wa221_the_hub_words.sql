-- wave221 (09/10/26): the Hub speaks as "the Hub", not "AI" (Steel: "I'd rather it be more personable rather than AI
-- anywhere in the hub. I just saw it in the comments under meeting AI."). Everywhere but the Admin centre.
-- Markers the database matches stay as they are ("AI: <meeting>" in updated_by, added_by, raised_by, changed_by);
-- the pages read them through waWho() (build/src/221_wave221.seg).

-- comment authors: the meeting and Slack passes sign as the Hub (now and from here on)
update public.task_comments set author = 'The Hub, from the meeting' where author = 'Meeting AI';
update public.task_comments set author = 'The Hub, from Slack' where author = 'Slack AI';

create or replace function public.wa221_comment_author() returns trigger
language plpgsql set search_path to '' as $$
begin
  if new.author = 'Meeting AI' then new.author := 'The Hub, from the meeting';
  elsif new.author = 'Slack AI' then new.author := 'The Hub, from Slack';
  end if;
  return new;
end $$;
comment on function public.wa221_comment_author() is 'wave221: signs the meeting and Slack passes'' task comments as the Hub ("The Hub, from the meeting", "The Hub, from Slack") whatever the edge function sends (it still writes Meeting AI or Slack AI).';
create or replace trigger trg_wa221_comment_author before insert or update of author on public.task_comments
  for each row execute function public.wa221_comment_author();

-- requests filed from a meeting suggestion: "X (from a meeting)", as the request sheet already showed them
update public.dept_requests set requested_by = regexp_replace(requested_by, '^Meeting AI \(accepted by (.+)\)$', '\1 (from a meeting)')
 where requested_by ~ '^Meeting AI \(accepted by .+\)$';
update public.change_log set changed_by = regexp_replace(changed_by, '^Meeting AI \(accepted by (.+)\)$', '\1 (from a meeting)')
 where changed_by ~ '^Meeting AI \(accepted by .+\)$';

-- (the goal gap suggestion's reason is written by the page from now on as "Goal gap suggestion from the Hub: "; no rows had the old one)

-- the Hub modules (wording only: updated_at kept)
update public.trainings set description = replace(description, 'with the wins the AI spotted in meetings', 'with the wins the Hub spotted in meetings'), updated_at = updated_at where id = 40;
update public.trainings set description = replace(description, 'It lists everything the AI intends to do', 'It lists everything the Hub intends to do'), updated_at = updated_at where id = 41;
update public.trainings set description = replace(description, '- Asks the AI heard in meetings.', '- Asks the Hub heard in meetings.'), updated_at = updated_at where id = 42;
update public.trainings set description = replace(description, 'any box where you tell the Hub''s AI what to do', 'any box where you tell the Hub what to do'), updated_at = updated_at where id = 46;
