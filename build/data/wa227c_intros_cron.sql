-- wave227 (09/10/26), applied as migration wa227c_intros_cron: the weekly introduction is written every Monday at 10:10 UTC
-- (6:10 Toronto in summer time, 5:10 in winter), before anyone opens the Hub; intros answers at once and writes in the background.
-- (wa227_intros.sql already carries the tuning applied as wa227b_intros_tuning: the executive team and the board count as
-- working together, more stop words, "Executive team" for the exec code.)
select cron.schedule('wa-intros', '10 10 * * 1', $$select public.call_edge('intros', '{}'::jsonb)$$);
