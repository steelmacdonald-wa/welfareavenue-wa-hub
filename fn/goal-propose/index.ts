// Routed through the Hub model router (llm, task 'goals') on 25/09/26: OpenRouter picks the model per ai_routes; the request and response shapes are unchanged.
// Welfare Avenue: goal-propose (v1)
// Suggests quarterly goals for ONE department from its transcripts,
// board state, open tasks, projects and existing goals. Suggestions are
// cached on goal_ideas and shown on the goals page; a human decides
// whether any becomes a real goal. Nothing is added automatically.
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
const SYSTEM = `You are the planning brain for Welfare Avenue, a Montreal and Toronto charity run by co executive directors Steel and Suhaib. You are given one department's recent meeting summaries, updates, open tasks, projects and existing goals. Suggest the quarterly goals this department should consider for the UPCOMING quarters. The fiscal year runs October 1 to September 30: Q1 FY2027 is Oct 1 to Dec 31 2026, Q2 FY2027 is Jan 1 to Mar 31 2027, Q3 FY2027 is Apr 1 to Jun 30 2027, Q4 FY2027 is Jul 1 to Sep 30 2027.

Rules:
1. Never use em dashes anywhere. Use commas, colons, or parentheses.
2. Suggest 3 to 5 goals. Each must be SMART: a concrete outcome with a number or date in the measure, achievable in one quarter.
3. Ground every suggestion in the evidence given: name the transcript theme, task cluster or project it comes from in the why field. Do not invent initiatives nobody has discussed unless the department state clearly implies the gap.
4. Do NOT duplicate or trivially reword existing goals, including archived ones. Read them first. A follow on to an existing goal is fine when it advances to a new stage.
5. quarter: the best upcoming quarter for the goal, usually Q1 FY2027 unless the evidence says later.
6. title under 15 words. detail: 1 to 2 sentences describing the goal in plain words. measure: the number or outcome that counts as done.
7. note: one line on the department's goal coverage overall.`;
const TOOL = {
  name: 'propose_goals',
  description: 'Return suggested quarterly goals for this department.',
  input_schema: {
    type: 'object',
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: {
              type: 'string'
            },
            detail: {
              type: 'string'
            },
            measure: {
              type: 'string'
            },
            quarter: {
              type: 'string'
            },
            why: {
              type: 'string'
            }
          },
          required: [
            'title',
            'detail',
            'measure',
            'quarter',
            'why'
          ]
        }
      },
      note: {
        type: 'string'
      }
    },
    required: [
      'suggestions',
      'note'
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
        'x-wa-task': 'goals',
        'x-wa-caller': 'goal-propose',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 2200,
        temperature: 0.4,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: 'DEPARTMENT STATE (JSON):\n' + JSON.stringify(context)
          }
        ],
        tools: [
          TOOL
        ],
        tool_choice: {
          type: 'tool',
          name: 'propose_goals'
        }
      })
    });
    if (res.ok) {
      const body = await res.json();
      const tu = (body.content || []).find((c)=>c.type === 'tool_use');
      if (tu?.input) return tu.input;
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
  const dept = String(body.department || '');
  if (!dept) return json({
    error: 'department required'
  }, 400);
  const [metaQ, txQ, updQ, tasksQ, projQ, goalsQ] = await Promise.all([
    svc.from('dept_meta').select('read, progress, priorities').eq('department', dept).maybeSingle(),
    svc.from('transcripts').select('title, meeting_date, ai_summary').eq('department', dept).order('meeting_date', {
      ascending: false
    }).limit(8),
    svc.from('dept_updates').select('entry_label, text').eq('department', dept).order('id', {
      ascending: false
    }).limit(10),
    svc.from('dept_tasks').select('title, status').eq('department', dept).eq('done', false).limit(60),
    svc.from('projects').select('name, description, status').eq('department', dept),
    svc.from('goals').select('title, detail, measure, quarter, status, department').or('department.eq.' + dept + ',department.eq.org')
  ]);
  const context = {
    department: dept,
    today: new Date().toISOString().slice(0, 10),
    overview: metaQ.data || {},
    recent_meetings: txQ.data || [],
    recent_updates: updQ.data || [],
    open_tasks: (tasksQ.data || []).map((t)=>t.title),
    projects: projQ.data || [],
    existing_goals_do_not_duplicate: goalsQ.data || []
  };
  try {
    const result = await callAnthropic(context);
    const payload = {
      suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
      note: String(result.note || ''),
      generated: new Date().toISOString()
    };
    const { error: upErr } = await svc.from('goal_ideas').upsert({
      department: dept,
      payload,
      generated_at: new Date().toISOString()
    });
    if (upErr) console.error('cache write failed', upErr);
    return json({
      department: dept,
      ...payload
    });
  } catch (e) {
    return json({
      error: String(e.message || e).slice(0, 300)
    }, 500);
  }
});
