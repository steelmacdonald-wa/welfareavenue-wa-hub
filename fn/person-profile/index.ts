// Routed through the Hub model router (llm, task 'profile') on 25/09/26: OpenRouter picks the model per ai_routes; the request and response shapes are unchanged.
// Welfare Avenue: person-profile (v1)
// Builds a short AI job description for one team member from what they
// actually own across the Hub: open tasks, work finished this fiscal
// year, and the SOP steps they run for upcoming serving events. Caches
// to team_members.ai_bio / ai_bio_at.
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
const json = (body, status = 200)=>new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json'
    }
  });
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
    const email = (data?.user?.email || '').toLowerCase();
    if (email.endsWith('@welfareavenue.com')) return true;
  }
  return false;
}
function fyStart() {
  const now = new Date();
  const y = now.getUTCMonth() + 1 >= 10 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return y + '-10-01';
}
const SYSTEM = `You write one short job description for a member of Welfare Avenue, a Montreal and Toronto charity. You are given their name, role, department, and the real work attached to them on the internal Hub: open tasks, tasks finished this fiscal year, and the serving event checklist steps they run.

Rules:
1. Never use em dashes anywhere. Use commas, colons, or parentheses.
2. Write 2 to 3 sentences, warm and specific, in third person, present tense. Name the concrete things they actually run or deliver, drawn from the task titles given. Do not invent work that is not in the data.
3. If the data is thin, say what their role covers in one modest sentence rather than padding.
4. No headers, no bullets, no quotes around the text.`;
const TOOL = {
  name: 'write_bio',
  description: 'Return the job description.',
  input_schema: {
    type: 'object',
    properties: {
      bio: {
        type: 'string',
        description: '2 to 3 sentence job description'
      }
    },
    required: [
      'bio'
    ]
  }
};
const MODELS = [
  'claude-sonnet-5',
  'claude-sonnet-4-5',
  'claude-sonnet-4-20250514'
];
async function callAnthropic(context) {
  const key = 'hub-router';
  let lastErr = '';
  for (const model of MODELS){
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'x-wa-task': 'profile',
        'x-wa-caller': 'person-profile',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        temperature: 0.4,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: 'TEAM MEMBER AND THEIR WORK (JSON):\n' + JSON.stringify(context)
          }
        ],
        tools: [
          TOOL
        ],
        tool_choice: {
          type: 'tool',
          name: 'write_bio'
        }
      })
    });
    if (res.ok) {
      const body = await res.json();
      const tu = (body.content || []).find((c)=>c.type === 'tool_use');
      if (tu?.input?.bio) return String(tu.input.bio);
      lastErr = 'no tool_use block';
      continue;
    }
    lastErr = res.status + ' ' + (await res.text()).slice(0, 200);
    if (res.status !== 404 && res.status !== 400) break;
  }
  throw new Error('Anthropic call failed: ' + lastErr);
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: CORS
  });
  if (!await authorize(req)) return json({
    error: 'unauthorized'
  }, 401);
  const body = await req.json().catch(()=>({}));
  const memberId = Number(body.member_id);
  if (!memberId) return json({
    error: 'member_id required'
  }, 400);
  const { data: m, error: mErr } = await svc.from('team_members').select('id, name, email, department, role, active, ai_bio, ai_bio_at').eq('id', memberId).maybeSingle();
  if (mErr || !m) return json({
    error: 'member not found'
  }, 404);
  const pat = '%' + String(m.name).trim().split(/\s+/)[0] + '%';
  const [openQ, doneQ, sopQ] = await Promise.all([
    svc.from('dept_tasks').select('id, title, department, status, project_id').eq('done', false).ilike('owner', pat).limit(120),
    svc.from('dept_tasks').select('id, title, department, closed_at').eq('done', true).gte('closed_at', fyStart()).ilike('owner', pat).limit(200),
    svc.from('sop_event_steps').select('id, template_id, event_id, owner, volunteer_events!inner(status, event_date)').ilike('owner', pat).eq('volunteer_events.status', 'planned').gte('volunteer_events.event_date', new Date().toISOString().slice(0, 10)).limit(300)
  ]);
  const sopSteps = sopQ.data || [];
  const tmplIds = Array.from(new Set(sopSteps.map((s)=>String(s.template_id)))).slice(0, 40);
  let sopNames = [];
  if (tmplIds.length) {
    const { data: tn } = await svc.from('sop_template').select('id, name').in('id', tmplIds);
    sopNames = (tn || []).map((t)=>String(t.name)).slice(0, 25);
  }
  const stats = {
    open: (openQ.data || []).length,
    done_fy: (doneQ.data || []).length,
    sop_steps_upcoming: sopSteps.length,
    sop_events: Array.from(new Set(sopSteps.map((s)=>s.event_id))).length
  };
  const wantFresh = body.refresh === true;
  if (!wantFresh && m.ai_bio && m.ai_bio_at && Date.now() - new Date(m.ai_bio_at).getTime() < 7 * 86400000) {
    return json({
      member_id: memberId,
      bio: m.ai_bio,
      cached: true,
      stats
    });
  }
  const context = {
    name: m.name,
    role: m.role,
    department: m.department,
    active: m.active,
    open_tasks: (openQ.data || []).map((t)=>t.title).slice(0, 60),
    finished_this_fiscal_year: (doneQ.data || []).map((t)=>t.title).slice(0, 80),
    serving_event_steps_they_run: sopNames,
    fiscal_year_started: fyStart()
  };
  try {
    const bio = await callAnthropic(context);
    await svc.from('team_members').update({
      ai_bio: bio,
      ai_bio_at: new Date().toISOString()
    }).eq('id', memberId);
    return json({
      member_id: memberId,
      bio,
      cached: false,
      stats
    });
  } catch (e) {
    if (m.ai_bio) return json({
      member_id: memberId,
      bio: m.ai_bio,
      cached: true,
      stale: true,
      stats
    });
    return json({
      error: String(e.message || e).slice(0, 300)
    }, 500);
  }
});
