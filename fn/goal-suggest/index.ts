// wave132 (26/09/26): leaves out what is in the bank (tasks and projects parked for three months or more carry banked_at until they come back).
// Routed through the Hub model router (llm, task 'goals') on 25/09/26: OpenRouter picks the model per ai_routes; the request and response shapes are unchanged.
// Welfare Avenue: goal-suggest (v1)
// Gap analysis for one quarterly goal: given the goal, its linked projects and
// all their open and recently closed tasks, Claude suggests the work that is
// MISSING: concrete tasks nobody has opened that the goal needs to land.
// Results cache on goals.suggestions / suggested_at; the dashboard shows the
// cached set until someone refreshes.
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
const SYSTEM = `You are the planning brain for Welfare Avenue, a Montreal and Toronto charity run by co executive directors Steel and Suhaib. You are given ONE quarterly goal, the projects linked to it, and every open and recently closed task in those projects and that department. Your job is GAP ANALYSIS: name the concrete work that is missing, not the work that exists.

Rules:
1. Never use em dashes anywhere. Use commas, colons, or parentheses.
2. Suggest 3 to 6 tasks. Each must be a concrete, startable action with a clear deliverable, not a category. Write titles like real task titles, under 15 words.
3. Do not suggest work that already appears in the task lists, even reworded. Read them carefully first.
4. Ground every suggestion in the goal's own success criteria: dates, percentages, counts named in the goal text. Work backwards from what the goal measures.
5. why: one sentence explaining the gap this closes, referencing the goal's criteria where possible.
6. project_id: the id of the linked project this task belongs in, or null for the department general list. Only use ids given to you.
7. If the goal looks fully covered by existing tasks, return fewer suggestions or an empty list with covered true.`;
const TOOL = {
  name: 'suggest_goal_gaps',
  description: 'Return the missing work for this goal.',
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
            why: {
              type: 'string'
            },
            project_id: {
              type: [
                'integer',
                'null'
              ]
            }
          },
          required: [
            'title',
            'why'
          ]
        }
      },
      covered: {
        type: 'boolean',
        description: 'True when existing tasks already cover the goal well.'
      },
      note: {
        type: 'string',
        description: 'One line on overall goal coverage.'
      }
    },
    required: [
      'suggestions',
      'covered',
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
        'x-wa-caller': 'goal-suggest',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 1800,
        temperature: 0.3,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: 'GOAL AND CURRENT WORK (JSON):\n' + JSON.stringify(context)
          }
        ],
        tools: [
          TOOL
        ],
        tool_choice: {
          type: 'tool',
          name: 'suggest_goal_gaps'
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
  const goalId = Number(body.goal_id);
  if (!goalId) return json({
    error: 'goal_id required'
  }, 400);
  const { data: goal, error: gErr } = await svc.from('goals').select('id, department, quarter, title, detail, measure, status, progress, due_date, task_ids').eq('id', goalId).maybeSingle();
  if (gErr || !goal) return json({
    error: 'goal not found'
  }, 404);
  const { data: projects } = await svc.from('projects').select('id, name, description, department').is('banked_at', null).eq('goal_id', goalId).eq('status', 'active');
  const projIds = (projects || []).map((p)=>p.id);
  const [projTasksQ, deptOpenQ, legacyQ] = await Promise.all([
    projIds.length ? svc.from('dept_tasks').select('id, title, done, owner, project_id').is('banked_at', null).in('project_id', projIds) : Promise.resolve({
      data: []
    }),
    svc.from('dept_tasks').select('id, title, done, owner').is('banked_at', null).eq('department', goal.department).eq('done', false).is('project_id', null),
    Array.isArray(goal.task_ids) && goal.task_ids.length ? svc.from('dept_tasks').select('id, title, done, owner').is('banked_at', null).in('id', goal.task_ids) : Promise.resolve({
      data: []
    })
  ]);
  const context = {
    goal: {
      id: goal.id,
      department: goal.department,
      quarter: goal.quarter,
      title: goal.title,
      detail: goal.detail,
      measure: goal.measure,
      status: goal.status,
      progress: goal.progress,
      due_date: goal.due_date
    },
    linked_projects: projects || [],
    tasks_in_linked_projects: projTasksQ.data || [],
    department_general_open_tasks: (deptOpenQ.data || []).slice(0, 80),
    tasks_historically_linked_to_goal: legacyQ.data || [],
    today: new Date().toISOString().slice(0, 10)
  };
  try {
    const result = await callAnthropic(context);
    const suggestions = Array.isArray(result.suggestions) ? result.suggestions : [];
    const payload = {
      suggestions,
      covered: result.covered === true,
      note: String(result.note || ''),
      generated: new Date().toISOString()
    };
    const { error: upErr } = await svc.from('goals').update({
      suggestions: payload,
      suggested_at: new Date().toISOString()
    }).eq('id', goalId);
    if (upErr) console.error('cache write failed', upErr);
    return json({
      goal_id: goalId,
      ...payload
    });
  } catch (e) {
    return json({
      error: String(e.message || e).slice(0, 300)
    }, 500);
  }
});
