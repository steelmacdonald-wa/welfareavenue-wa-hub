-- Welfare Avenue Hub: wave266 (266c), S1, 26/10/26. An itinerary text to a number Quo refuses (blocked) shows as failed,
-- not as queued forever. Safe to run twice. Undo: replace the new piece with the old one (both below).
do $$
declare d text; a text; n int;
begin
  d := pg_get_functiondef('public.wa182_itinerary_status'::regproc);
  if position('''sent'', ''failed'', ''blocked''' in d) > 0 then raise notice 'wave266c: already applied'; return; end if;
  a := $o$case when s.status = 'queued' and s.channel = 'text' and q.status in ('sent', 'failed') then q.status$o$;
  n := (length(d) - length(replace(d, a, ''))) / length(a);
  if n <> 1 then raise exception 'wave266c: matched % times', n; end if;
  execute replace(d, a, $n$case when s.status = 'queued' and s.channel = 'text' and q.status in ('sent', 'failed', 'blocked') then replace(q.status, 'blocked', 'failed')$n$);
end $$;
