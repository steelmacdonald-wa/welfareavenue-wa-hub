-- wave138 follow-up (26/09/26): the page parses @mentions itself, so the roster parser stays server-side only.
-- wa_mentioned_members() returns roster emails; the triggers call it as the function owner, so nobody else needs it.
revoke execute on function public.wa_mentioned_members(text) from authenticated;
comment on function public.wa_mentioned_members(text) is 'The active roster members a text @mentions: after each @ (not part of an email address), the longest team_members.name that follows, ending on a word boundary (not @joy.dumansi, which is a handle), case-insensitive; each person once. Used by the mention triggers. Access: service role and the triggers (it returns roster emails).';
