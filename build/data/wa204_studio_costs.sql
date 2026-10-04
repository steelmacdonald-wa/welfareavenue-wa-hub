-- wave204 (04/10/26): what the email studio's AI has cost, for the studio's What it costs panel.
-- Steel: "Could you add these costs somewhere in the studio so they know how much they are spending".
-- The llm router logs every call in ai_calls (task email_studio; cost in US dollars as OpenRouter reports it; admins read
-- the table; rows older than 90 days are pruned daily by wa-ai-calls-prune). This function gives the people who can save a
-- design in the studio (staff with the CRM page: not board viewers, not blocked accounts; the same test as email_studio_save)
-- the studio's totals only: this month and last month (Toronto time) and the last 90 days. Never a row, a model, an error
-- or who made a call (ai_calls does not know). Each email also keeps its own spend in its design (design.ai: calls, cost),
-- written by the studio itself.
create or replace function public.email_studio_costs()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_me text := public.wa_email();
  v_role text;
  v_local timestamp := now() at time zone 'America/Toronto';
  v_start timestamptz := date_trunc('month', v_local) at time zone 'America/Toronto';
  v_prev timestamptz := (date_trunc('month', v_local) - interval '1 month') at time zone 'America/Toronto';
  v_out jsonb;
begin
  select r.role into v_role from public.hub_roles r where r.email = v_me;
  if not public.is_wa_staff() or coalesce(v_role, 'member') in ('viewer', 'blocked') or coalesce(public.wa_page_ok('crm'), true) = false then
    raise exception 'not_allowed';
  end if;
  select jsonb_build_object(
    'month', jsonb_build_object('since', v_start, 'calls', count(*) filter (where c.created_at >= v_start),
                                'cost', round(coalesce(sum(c.cost) filter (where c.created_at >= v_start), 0), 6)),
    'last_month', jsonb_build_object('since', v_prev, 'calls', count(*) filter (where c.created_at >= v_prev and c.created_at < v_start),
                                     'cost', round(coalesce(sum(c.cost) filter (where c.created_at >= v_prev and c.created_at < v_start), 0), 6)),
    'd90', jsonb_build_object('calls', count(*), 'cost', round(coalesce(sum(c.cost), 0), 6)))
  into v_out
  from public.ai_calls c
  where c.task = 'email_studio' and c.created_at > now() - interval '90 days';
  return v_out;
end
$$;

revoke all on function public.email_studio_costs() from public, anon;
grant execute on function public.email_studio_costs() to authenticated;

comment on function public.email_studio_costs() is 'wave204: the email studio''s AI spend for its What it costs panel: {month: {since, calls, cost}, last_month: {since, calls, cost}, d90: {calls, cost}} from ai_calls (task email_studio, US dollars; months in Toronto time). Totals only. Staff with the CRM page (not board viewers or blocked accounts), as email_studio_save.';
