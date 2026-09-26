// Welfare Avenue: daily-alerts (v2, 25/07/26)
// v2: board_only confidentiality tier. Every query on dept_tasks and decisions
// now adds .eq('board_only', false) because these alerts post to a Slack
// channel visible to staff and the service role key bypasses RLS.
// v1: daily 9am Toronto check: tasks that just passed due, tasks 7 days overdue,
// decisions hitting 14 or 30 days open. Each item alerts once (exact day match).
import { createClient } from 'jsr:@supabase/supabase-js@2';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (b, s = 200)=>new Response(JSON.stringify(b), {
    status: s,
    headers: {
      ...CORS,
      'Content-Type': 'application/json'
    }
  });
const DEPT_LABEL = {
  opsmtl: 'Ops Montreal',
  progdev: 'Program Development',
  opsto: 'Ops Toronto',
  marketing: 'Marketing',
  fundraising: 'Fundraising and Finances',
  hr: 'HR',
  board: 'Board'
};
async function getSecret(name) {
  const { data, error } = await svc.rpc('get_secret', {
    secret_name: name
  });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data;
}
async function authorize(req) {
  try {
    const given = req.headers.get('x-wa-secret');
    if (given && given === await getSecret('WA_TRIGGER_SECRET')) return true;
  } catch (_) {}
  const authHeader = req.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    const { data } = await asUser.auth.getUser();
    if ((data?.user?.email || '').toLowerCase().endsWith('@welfareavenue.com')) return true;
  }
  return false;
}
async function siteUrl() {
  const { data } = await svc.from('app_config').select('value').eq('key', 'site_url').maybeSingle();
  return data?.value || 'https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/dashboard';
}
function isoDaysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: CORS
  });
  if (!await authorize(req)) return json({
    error: 'unauthorized'
  }, 401);
  // v2: all four queries exclude board_only rows; output goes to staff Slack.
  const [justDueQ, weekOverQ, aging14Q, aging30Q] = await Promise.all([
    svc.from('dept_tasks').select('id, title, department, owner, due_date').eq('board_only', false).eq('done', false).eq('due_date', isoDaysAgo(1)),
    svc.from('dept_tasks').select('id, title, department, owner, due_date').eq('board_only', false).eq('done', false).eq('due_date', isoDaysAgo(7)),
    svc.from('decisions').select('id, title, reason_category, opened_at').eq('board_only', false).eq('done', false).gte('opened_at', isoDaysAgo(14) + 'T00:00:00Z').lt('opened_at', isoDaysAgo(13) + 'T00:00:00Z'),
    svc.from('decisions').select('id, title, reason_category, opened_at').eq('board_only', false).eq('done', false).gte('opened_at', isoDaysAgo(30) + 'T00:00:00Z').lt('opened_at', isoDaysAgo(29) + 'T00:00:00Z')
  ]);
  const jd = justDueQ.data || [], wo = weekOverQ.data || [], a14 = aging14Q.data || [], a30 = aging30Q.data || [];
  if (!jd.length && !wo.length && !a14.length && !a30.length) return json({
    ok: true,
    sent: false
  });
  const site = await siteUrl();
  const lines = [
    ':small_orange_diamond: *Welfare Avenue Dashboard: aging check*'
  ];
  const taskLine = (t)=>'  • <' + site + '#task/' + t.id + '|' + t.title + '> (' + (DEPT_LABEL[t.department] || t.department) + (t.owner ? ', ' + t.owner : '') + ', due ' + t.due_date + ')';
  if (jd.length) {
    lines.push('*Just passed due date:*');
    jd.forEach((t)=>lines.push(taskLine(t)));
  }
  if (wo.length) {
    lines.push('*One week overdue:*');
    wo.forEach((t)=>lines.push(taskLine(t)));
  }
  const decLine = (d, days)=>'  • <' + site + '#decision/' + d.id + '|' + d.title + '> (' + days + ' days open' + (d.reason_category ? ', ' + d.reason_category : '') + ')';
  if (a14.length) {
    lines.push('*Decisions open 14 days:*');
    a14.forEach((d)=>lines.push(decLine(d, 14)));
  }
  if (a30.length) {
    lines.push('*Decisions open 30 days:*');
    a30.forEach((d)=>lines.push(decLine(d, 30)));
  }
  lines.push('<' + site + '#needs-me|Open the Needs me view>');
  const url = await getSecret('SLACK_WEBHOOK_URL');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: lines.join('\n')
    })
  });
  return json({
    ok: res.ok,
    sent: true
  });
});
