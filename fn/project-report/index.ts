// Routed through the Hub model router (llm, task 'draft') on 25/09/26: OpenRouter picks the model per ai_routes; the request and response shapes are unchanged.
// Welfare Avenue: project-report (v1, 07/08/26)
// Builds the narrative for a downloadable project report: what each
// department needs to deliver, who is doing what, suggested next steps and
// watch-outs, grounded in the project's live tasks. Staff JWT only. Returns
// JSON; the client renders and downloads the document, nothing is stored.
import { createClient } from 'jsr:@supabase/supabase-js@2';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (b, s = 200)=>new Response(JSON.stringify(b), {
    status: s,
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
async function staffEmail(req) {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });
  const { data } = await asUser.auth.getUser();
  const email = (data?.user?.email || '').toLowerCase();
  return email.endsWith('@welfareavenue.com') || email === 'steelmacdonald@gmail.com' ? email : null;
}
const SYSTEM = `You write concise, energising project status reports for Welfare Avenue, a Montreal and Toronto charity serving meals to people experiencing homelessness. You receive one project with its description and every live task (open and recently completed) across all departments, with owners and due dates. Write for the two co executive directors and department leads.

Rules:
1. Never use em dashes. Use commas, colons, parentheses.
2. Ground EVERYTHING in the provided tasks: never invent work, people, or dates. Refer to real task titles and owners.
3. overview: 3 to 5 sentences: where the project stands, momentum, the crunch points, nearest deadlines.
4. departments: one entry per department that has tasks: what that team owns in this project and what is NEEDED from them next (specific, referencing their open tasks and dues).
5. people: the key people doing the work and their focus, from task ownership. Only people who own tasks.
6. next_steps: 3 to 6 concrete suggested NEW actions that would move the project forward, inferred from gaps: sequencing, unowned work, coordination between departments, approaching dates. These are suggestions, mark nothing as decided.
7. watch_outs: up to 4 risks (overdue or dueless critical tasks, single points of failure, dependencies).
8. Executive tone: clear, warm, specific.`;
const TOOL = {
  name: 'write_report',
  description: 'Return the project report sections.',
  input_schema: {
    type: 'object',
    properties: {
      overview: {
        type: 'string'
      },
      departments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            department: {
              type: 'string'
            },
            what_they_own: {
              type: 'string'
            },
            needed_next: {
              type: 'string'
            }
          },
          required: [
            'department',
            'what_they_own',
            'needed_next'
          ]
        }
      },
      people: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string'
            },
            focus: {
              type: 'string'
            }
          },
          required: [
            'name',
            'focus'
          ]
        }
      },
      next_steps: {
        type: 'array',
        items: {
          type: 'string'
        }
      },
      watch_outs: {
        type: 'array',
        items: {
          type: 'string'
        }
      }
    },
    required: [
      'overview',
      'departments',
      'people',
      'next_steps',
      'watch_outs'
    ]
  }
};
const MODELS = [
  'claude-sonnet-5',
  'claude-sonnet-4-5',
  'claude-sonnet-4-20250514'
];
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: CORS
  });
  const email = await staffEmail(req);
  if (!email) return json({
    error: 'staff only'
  }, 401);
  const body = await req.json().catch(()=>({}));
  const pid = Number(body.project_id);
  if (!pid) return json({
    error: 'project_id required'
  }, 400);
  const [projQ, tasksQ] = await Promise.all([
    svc.from('projects').select('*').eq('id', pid).maybeSingle(),
    svc.from('dept_tasks').select('id, title, department, owner, due_date, done, closed_at, status, flag').eq('project_id', pid).order('done').order('due_date', {
      ascending: true,
      nullsFirst: false
    }).limit(300)
  ]);
  const p = projQ.data;
  if (!p) return json({
    error: 'project not found'
  }, 404);
  const tasks = (tasksQ.data || []).filter((t)=>!t.done || t.closed_at && Date.parse(t.closed_at) > Date.now() - 45 * 86400000);
  const context = {
    today: new Date().toISOString().slice(0, 10),
    project: {
      name: p.name,
      description: p.description,
      department: p.department,
      status: p.status
    },
    open_tasks: tasks.filter((t)=>!t.done),
    recently_completed: tasks.filter((t)=>t.done)
  };
  try {
    const key = 'hub-router';
    let lastErr = '';
    for (const model of MODELS){
      const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'x-wa-task': 'draft',
        'x-wa-caller': 'project-report',
        'Content-Type': 'application/json'
      },
        body: JSON.stringify({
          model,
          max_tokens: 4000,
          temperature: 0.2,
          system: SYSTEM,
          messages: [
            {
              role: 'user',
              content: 'PROJECT DATA:\n' + JSON.stringify(context)
            }
          ],
          tools: [
            TOOL
          ],
          tool_choice: {
            type: 'tool',
            name: 'write_report'
          }
        })
      });
      if (res.ok) {
        const b2 = await res.json();
        const tu = (b2.content || []).find((c)=>c.type === 'tool_use');
        if (tu?.input) return json({
          report: tu.input,
          project: context.project,
          open_tasks: context.open_tasks,
          recently_completed: context.recently_completed,
          generated_by: email
        });
        lastErr = 'no tool_use returned';
        continue;
      }
      lastErr = res.status + ' ' + (await res.text()).slice(0, 200);
      if (res.status !== 404 && res.status !== 400) break;
    }
    return json({
      error: 'report generation failed: ' + lastErr
    }, 500);
  } catch (e) {
    return json({
      error: String(e.message || e).slice(0, 200)
    }, 500);
  }
});
