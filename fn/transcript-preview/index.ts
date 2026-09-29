// wave165 (29/09/26): the tasks and decisions an upload's preview matches against are the open ones (one-on-ones are only for the people speaking in them now: visibility speakers; restricted work never
// reaches the person uploading).
// wave136 (26/09/26): for a Marketing meeting the preview also lists the content ideas that will go to the Content calendar's Ideas.
// wave132 (26/09/26): leaves out what is in the bank (tasks and projects parked for three months or more carry banked_at until they come back).
// Routed through the Hub model router (llm, task 'transcript_preview') on 25/09/26: OpenRouter picks the model per ai_routes; the request and response shapes are unchanged.
// Welfare Avenue: transcript-preview (v1, 04/08/26)
// Dry run before upload: the Hub sends the transcript text BEFORE saving
// it, and this function returns the actions the pipeline is expected to
// take (updates, new tasks, closures, decisions, request suggestions,
// goal wins, mentions) so the uploader can review and approve. Nothing is
// written anywhere: the real pipeline runs only after the user approves
// and the transcript row is actually inserted. The preview is the same
// model reading the same board state, so it is a close estimate, not a
// guarantee.
import { createClient } from 'jsr:@supabase/supabase-js@2';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const OPEN_VIS = 'visibility.is.null,visibility.eq.department'; /* wave165: open work only (not leadership, confidential or one-on-one) */
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
const DEPTS = [
  'opsmtl',
  'progdev',
  'opsto',
  'marketing',
  'fundraising',
  'hr',
  'board'
];
const MODELS = [
  'claude-sonnet-5',
  'claude-sonnet-4-5',
  'claude-sonnet-4-20250514'
];
async function getSecret(name) {
  const { data } = await svc.rpc('get_secret', {
    secret_name: name
  });
  return data || null;
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
const SYSTEM = 'You PREVIEW what the Welfare Avenue transcript pipeline will do with a meeting transcript, before it is uploaded, so the uploader can approve. Read the transcript against the current board state and predict, conservatively and factually, what will be filed. Route each item to the department that owns it (a leadership meeting spreads across all departments; a department meeting mostly stays in its own). Closures need clear completion evidence. Requests are only explicit cross team asks; when an ask matches an open request, mark it refine. Goal wins are concrete completed or measurable progress on a listed goal. Mentions are roster members who did not speak but had work discussed or assigned. Work the meeting clearly puts off by three months or more is still a new task, with bank_until set to the ISO date it should come back: the pipeline parks it in the bank until then. Never invent people, dates, or ids. No em dashes anywhere in your text.';
const TOOL = {
  name: 'preview_actions',
  description: 'Return the actions the pipeline is expected to take for this transcript.',
  input_schema: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'One line: what this meeting covered.'
      },
      new_updates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            department: {
              type: 'string',
              enum: DEPTS
            },
            gist: {
              type: 'string',
              description: 'One short line of what the update will say.'
            }
          },
          required: [
            'department',
            'gist'
          ]
        }
      },
      new_tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            department: {
              type: 'string',
              enum: DEPTS
            },
            title: {
              type: 'string'
            },
            owner: {
              type: 'string'
            },
            bank_until: {
              type: [
                'string',
                'null'
              ],
              description: 'Only when the meeting puts this work off by three months or more: the ISO date it should come back. Null otherwise.'
            }
          },
          required: [
            'department',
            'title',
            'owner'
          ]
        }
      },
      close_tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'The open task title being closed, from the numbered list.'
            },
            evidence: {
              type: 'string'
            }
          },
          required: [
            'title',
            'evidence'
          ]
        }
      },
      new_decisions: {
        type: 'array',
        items: {
          type: 'string'
        }
      },
      requests: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            department: {
              type: 'string',
              enum: DEPTS
            },
            title: {
              type: 'string'
            },
            kind: {
              type: 'string',
              enum: [
                'new',
                'refine'
              ]
            }
          },
          required: [
            'department',
            'title',
            'kind'
          ]
        }
      },
      goal_wins: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            goal: {
              type: 'string'
            },
            win: {
              type: 'string'
            }
          },
          required: [
            'goal',
            'win'
          ]
        }
      },
      mentions: {
        type: 'array',
        items: {
          type: 'string'
        }
      },
      content_ideas: {
        type: 'array',
        description: 'Marketing meetings only (empty for every other department): ideas for posts, reels, carousels, stories or series raised in the meeting, even when nobody committed to making them. They go to the Content calendar Ideas.',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'A short working title, 3 to 8 words.' },
            for_date: { type: ['string', 'null'], description: 'ISO date the idea is for when the meeting ties it to a date, event or season, else null.' }
          },
          required: ['title']
        }
      }
    },
    required: [
      'summary',
      'new_updates',
      'new_tasks',
      'close_tasks',
      'new_decisions',
      'requests',
      'goal_wins',
      'mentions'
    ]
  }
};
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: CORS
  });
  if (!await authorize(req)) return json({
    error: 'unauthorized'
  }, 401);
  const key = 'hub-router';
  if (!key) return json({
    error: 'ANTHROPIC_API_KEY missing'
  }, 500);
  const body = await req.json().catch(()=>({}));
  const text = String(body.body || '');
  if (text.trim().length < 40) return json({
    error: 'transcript too short'
  }, 400);
  const dept = String(body.department || '');
  const isLead = body.visibility === 'leadership' || /leadership/i.test(dept);
  const [tasksQ, typesQ, reqsQ, goalsQ, rosterQ, decQ] = await Promise.all([
    svc.from('dept_tasks').select('id,title,department,owner').is('banked_at', null).eq('done', false).or(OPEN_VIS).limit(400),
    svc.from('request_types').select('key,label,department,description').eq('enabled', true),
    svc.from('dept_requests').select('id,title,department').eq('done', false).limit(50),
    svc.from('goals').select('id,department,quarter,title,measure,status').limit(60),
    svc.from('team_members').select('name,department').eq('active', true),
    svc.from('decisions').select('id,title').eq('done', false).or(OPEN_VIS)
  ]);
  const tasksTxt = (tasksQ.data || []).map((t)=>t.id + '. ' + t.title + ' (' + t.department + (t.owner ? ', owner ' + t.owner : '') + ')').join('\n');
  const typesTxt = (typesQ.data || []).map((t)=>'- ' + t.key + ': ' + (t.label || t.key) + ' (actioned by ' + t.department + '). ' + (t.description || '')).join('\n');
  const reqsTxt = (reqsQ.data || []).map((r)=>'- ' + r.title + ' (' + r.department + ')').join('\n');
  const goalsTxt = (goalsQ.data || []).filter((g)=>[
      'closed',
      'done',
      'archived'
    ].indexOf(String(g.status)) < 0).map((g)=>'- ' + g.title + ' (' + g.department + (g.measure ? ', measured by: ' + g.measure : '') + ')').join('\n');
  const rosterTxt = (rosterQ.data || []).map((m)=>'- ' + m.name + ' (' + (m.department || '') + ')').join('\n');
  const decTxt = (decQ.data || []).map((d)=>'- ' + d.title).join('\n');
  const user = 'MEETING: ' + String(body.title || 'Untitled') + ' (' + dept + ', ' + String(body.meeting_date || 'no date') + ')' + (isLead ? '\nMEETING KIND: LEADERSHIP (all departments; spread items across departments)' : '\nMEETING KIND: DEPARTMENT') + '\n\nOPEN TASKS:\n' + tasksTxt + '\n\nOPEN EXECUTIVE DECISIONS:\n' + decTxt + '\n\nREQUEST TYPES:\n' + typesTxt + '\n\nOPEN REQUESTS:\n' + reqsTxt + '\n\nQUARTERLY GOALS:\n' + goalsTxt + '\n\nROSTER:\n' + rosterTxt + '\n\nTRANSCRIPT:\n' + text.slice(0, 30000);
  let lastErr = '';
  for (const model of MODELS){
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'x-wa-task': 'transcript_preview',
        'x-wa-caller': 'transcript-preview',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 2500,
        temperature: 0,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: user
          }
        ],
        tools: [
          TOOL
        ],
        tool_choice: {
          type: 'tool',
          name: 'preview_actions'
        }
      })
    });
    if (res.ok) {
      const out = await res.json();
      const tu = (out.content || []).find((c)=>c.type === 'tool_use');
      if (tu?.input && !/market/i.test(dept)) tu.input.content_ideas = []; /* wave136: content ideas come from Marketing meetings only */
      if (tu?.input) return json({
        ok: true,
        preview: tu.input,
        is_leadership: isLead
      });
      lastErr = 'no tool_use block';
      continue;
    }
    lastErr = res.status + ' ' + (await res.text()).slice(0, 200);
    if (res.status !== 404 && res.status !== 400) break;
  }
  return json({
    error: 'preview failed: ' + lastErr
  }, 502);
});
