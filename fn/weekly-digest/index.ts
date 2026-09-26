// Welfare Avenue: weekly-digest (v2, 25/07/26)
// v2: board_only confidentiality tier. Every query on dept_updates, decisions
// and dept_tasks now adds .eq('board_only', false) because this digest posts to
// a Slack channel visible to staff and the service role key bypasses RLS.
// v1: Monday morning Slack summary for Steel and Suhaib. Called by pg_cron.
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
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: CORS
  });
  if (!await authorize(req)) return json({
    error: 'unauthorized'
  }, 401);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  // v2: all six queries exclude board_only rows; output goes to staff Slack.
  const [updatesQ, newDecQ, decidedQ, agingDecQ, overdueQ, closedQ] = await Promise.all([
    svc.from('dept_updates').select('department').eq('board_only', false).gte('created_at', weekAgo),
    svc.from('decisions').select('title, reason_category').eq('board_only', false).eq('done', false).gte('opened_at', weekAgo),
    svc.from('decisions').select('title, decided_note').eq('board_only', false).gte('decided_at', weekAgo),
    svc.from('decisions').select('title, opened_at').eq('board_only', false).eq('done', false).lt('opened_at', new Date(Date.now() - 14 * 86400000).toISOString()),
    svc.from('dept_tasks').select('title, department, due_date, owner').eq('board_only', false).eq('done', false).lt('due_date', today),
    svc.from('dept_tasks').select('id').eq('board_only', false).eq('done', true).gte('closed_at', weekAgo)
  ]);
  const site = await siteUrl();
  const updByDept = {};
  (updatesQ.data || []).forEach((u)=>{
    updByDept[u.department] = (updByDept[u.department] || 0) + 1;
  });
  const updLine = Object.keys(updByDept).length ? Object.entries(updByDept).map(([d, n])=>DEPT_LABEL[d] + ' ' + n).join(', ') : 'none';
  const lines = [];
  lines.push(':large_green_circle: *Welfare Avenue Weekly Executive Digest*');
  lines.push('*Updates this week:* ' + updLine + '. Tasks closed: ' + (closedQ.data?.length || 0) + '.');
  const nd = newDecQ.data || [];
  if (nd.length) {
    lines.push('*New decisions needing you (' + nd.length + '):*');
    nd.slice(0, 6).forEach((d)=>lines.push('  • ' + d.title + (d.reason_category ? ' (' + d.reason_category + ')' : '')));
  }
  const dd = decidedQ.data || [];
  if (dd.length) lines.push('*Decided this week:* ' + dd.map((d)=>d.title).slice(0, 5).join('; ') + '.');
  const ag = agingDecQ.data || [];
  if (ag.length) {
    lines.push('*Aging past 14 days (' + ag.length + '):*');
    ag.slice(0, 6).forEach((d)=>{
      const days = Math.round((Date.now() - new Date(d.opened_at).getTime()) / 86400000);
      lines.push('  • ' + d.title + ' (' + days + 'd open)');
    });
  }
  const ov = overdueQ.data || [];
  if (ov.length) {
    lines.push('*Overdue tasks (' + ov.length + '):*');
    ov.slice(0, 6).forEach((t)=>lines.push('  • ' + t.title + ' (' + (DEPT_LABEL[t.department] || t.department) + ', due ' + t.due_date + ')'));
  }
  if (!nd.length && !ag.length && !ov.length) lines.push('No new, aging, or overdue executive items. Clean board.');
  lines.push('<' + site + '#decisions|Open Decisions>  |  <' + site + '#needs-me|Needs me view>');
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
    ok: res.ok
  });
});
