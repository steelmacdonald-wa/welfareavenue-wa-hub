// wave164 (29/09/26): Finance is its own team, apart from Fundraising: leadership items about the books can go to finance; Fundraising
// is called Fundraising.
// wave132 (26/09/26): leaves out what is in the bank (tasks and projects parked for three months or more carry banked_at until they come back).
// Routed through the Hub model router (llm, task 'leadership') on 25/09/26: OpenRouter picks the model per ai_routes; the request and response shapes are unchanged.
// v3 (29/09/26, wave162): a leadership meeting the Loom pull filed posts its Slack note only when app_config loom_pull_slack is 'on'
// (off by default), like process-transcript v15. Nothing else changed.
// Welfare Avenue: process-leadership (v2, 04/08/26)
// v2: leadership meetings can now be OPEN. The transcript's visibility
// decides what gets stamped on the fan-out rows: 'leadership' keeps them
// for leaders and admins, 'private' keeps them to the picked people, and
// department/none leaves them visible to everyone. The fan-out across
// ALL departments happens in every case. Slack gets the real summary for
// open meetings and a counts-only note for restricted ones.
// v1: processes LEADERSHIP meetings across all departments; sibling of
// the protected process-transcript (untouched). Fired by the wa65 DB
// trigger on transcripts whose department mentions Leadership; the
// department pipeline's fast 'unknown department' failure note is
// overwritten by this function's real summary when it finishes.
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
const DEPTS = [
  'opsmtl',
  'progdev',
  'opsto',
  'marketing',
  'fundraising',
  'finance',
  'hr',
  'board'
];
const DEPT_LABEL = {
  opsmtl: 'Ops Montreal',
  progdev: 'Program Development',
  opsto: 'Ops Toronto',
  marketing: 'Marketing',
  fundraising: 'Fundraising',
  finance: 'Finance',
  hr: 'Human Resources',
  board: 'Board and Governance'
};
const MODELS = [
  'claude-sonnet-5',
  'claude-sonnet-4-5',
  'claude-sonnet-4-20250514'
];
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
async function postSlack(text) {
  try {
    const url = await getSecret('SLACK_WEBHOOK_URL');
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text
      })
    });
  } catch (e) {
    console.error('slack post failed', e);
  }
}
async function siteUrl() {
  const { data } = await svc.from('app_config').select('value').eq('key', 'site_url').maybeSingle();
  return data?.value || 'https://wa-exec-dashboard.netlify.app';
}
const SYSTEM = `You maintain the Welfare Avenue executive status board. You are reading a LEADERSHIP MEETING transcript: the leaders of every department are present, so what the meeting produces must be SPREAD ACROSS DEPARTMENTS. Route every new update and every new task to the single department that will own it (opsmtl, progdev, opsto, marketing, fundraising, finance, hr, board; finance is the books, apart from fundraising), based on who is doing the work and which team it belongs to. Do not funnel everything into one department.

Rules:
1. Never use em dashes in any text you produce. Use commas, colons, parentheses, or the word "to" for ranges.
2. Executive tone: concise, specific, energetic where it counts.
3. Never invent people. Owners must be names from the roster provided. Transcripts garble names; map a spoken name to a roster name only when confident, otherwise keep the transcript spelling.
4. Review the numbered open task list against the transcript and be CONSERVATIVE about closing. Only include a task in close_tasks when the transcript clearly states the work is done, shipped, delivered, resolved, signed, hired, or explicitly cancelled. Provide evidence: a short quote or close paraphrase plus the exact task_id. Never close on inference.
5. Avoid duplicate tasks: when the meeting discusses work an open task already covers, do not create a new task for it.
6. new_updates: 2 to 6 new update entries, each routed to the department it concerns, label like "Aug 4 (Leadership)".
7. due_date only when the transcript states or strongly implies a date (ISO format).
8. Raise a new executive decision only when a call needs Steel or Suhaib personally, with reason_category and a one line reason_note. Categories: Budget or purchase; Hiring or people; Legal, risk, or governance; Strategy or direction; Partnership or external; Ethics or policy.
9. If the transcript shows an open executive decision was made, include its id in decide_decisions with a short decided_note quoting the call.
10. Project routing: give a new task a project_id only when it clearly belongs to a listed project; otherwise null. Never invent project ids.
11. mark confidential true on anything about succession, individual performance, or personnel issues.
12. summary: one line, under 30 words, stating what changed across which departments.`;
const TOOL = {
  name: 'apply_leadership_update',
  description: 'Apply the leadership meeting findings across the department boards.',
  input_schema: {
    type: 'object',
    properties: {
      new_updates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            department: {
              type: 'string',
              enum: DEPTS
            },
            label: {
              type: 'string'
            },
            text: {
              type: 'string'
            }
          },
          required: [
            'department',
            'label',
            'text'
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
            due_date: {
              type: [
                'string',
                'null'
              ]
            },
            flag: {
              type: 'boolean'
            },
            reason_category: {
              type: [
                'string',
                'null'
              ]
            },
            reason_note: {
              type: [
                'string',
                'null'
              ]
            },
            confidential: {
              type: 'boolean'
            },
            project_id: {
              type: [
                'integer',
                'null'
              ]
            }
          },
          required: [
            'department',
            'title',
            'owner',
            'flag'
          ]
        }
      },
      close_tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            task_id: {
              type: 'integer'
            },
            evidence: {
              type: 'string'
            }
          },
          required: [
            'task_id',
            'evidence'
          ]
        }
      },
      new_decisions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: {
              type: 'string'
            },
            area: {
              type: 'string'
            },
            suggested_move: {
              type: 'string'
            },
            owner: {
              type: [
                'string',
                'null'
              ]
            },
            reason_category: {
              type: 'string'
            },
            reason_note: {
              type: 'string'
            },
            confidential: {
              type: 'boolean'
            }
          },
          required: [
            'title',
            'area',
            'suggested_move',
            'reason_category',
            'reason_note'
          ]
        }
      },
      decide_decisions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'integer'
            },
            decided_note: {
              type: 'string'
            }
          },
          required: [
            'id',
            'decided_note'
          ]
        }
      },
      summary: {
        type: 'string'
      }
    },
    required: [
      'summary',
      'new_updates',
      'new_tasks',
      'close_tasks',
      'new_decisions',
      'decide_decisions'
    ]
  }
};
async function callAnthropic(context, transcriptText) {
  const key = 'hub-router';
  const userContent = 'CONTEXT (current board state, JSON):\n' + JSON.stringify(context) + '\n\nTRANSCRIPT:\n' + transcriptText.slice(0, 30000);
  let lastErr = '';
  for (const model of MODELS){
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'x-wa-task': 'leadership',
        'x-wa-caller': 'process-leadership',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 3500,
        temperature: 0.2,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: userContent
          }
        ],
        tools: [
          TOOL
        ],
        tool_choice: {
          type: 'tool',
          name: 'apply_leadership_update'
        }
      })
    });
    if (res.ok) {
      const body = await res.json();
      const tu = (body.content || []).find((c)=>c.type === 'tool_use');
      if (tu?.input) return tu.input;
      lastErr = 'no tool_use block returned';
      continue;
    }
    lastErr = res.status + ' ' + (await res.text()).slice(0, 300);
    if (res.status !== 404 && res.status !== 400) break;
  }
  throw new Error('Anthropic call failed: ' + lastErr);
}
async function processLeadership(transcriptId) {
  const { data: tx, error } = await svc.from('transcripts').select('*').eq('id', transcriptId).single();
  if (error || !tx) throw new Error('transcript not found');
  if (!tx.body || tx.body.trim().length < 40) throw new Error('transcript body too short to process');
  const isLead = tx.visibility === 'leadership' || /leadership/i.test(String(tx.department || ''));
  if (!isLead) throw new Error('not a leadership meeting');
  if (tx.processed === true) return {
    note: 'already processed'
  };
  // v2: what the fan-out rows inherit
  const stampVis = tx.visibility === 'leadership' ? 'leadership' : tx.visibility === 'private' ? 'private' : null;
  const stampPeople = stampVis === 'private' && Array.isArray(tx.allowed_people) ? tx.allowed_people : null;
  const restricted = stampVis !== null;
  const [tasksQ, decQ, rosterQ, projQ] = await Promise.all([
    svc.from('dept_tasks').select('id, title, department, owner, due_date').is('banked_at', null).eq('done', false),
    svc.from('decisions').select('id, title, area, owner').eq('done', false),
    svc.from('team_members').select('name, role, department').eq('active', true),
    svc.from('projects').select('id, name, description, department, parent_id').is('banked_at', null).eq('status', 'active').order('department').order('sort')
  ]);
  const openTasksNumbered = (tasksQ.data || []).map((t, i)=>i + 1 + '. task_id ' + t.id + ': ' + t.title + ' (' + t.department + ', owner: ' + (t.owner || 'unassigned') + ')').join('\n');
  const projRows = projQ.data || [];
  const projName = new Map(projRows.map((p)=>[
      p.id,
      p.name
    ]));
  const projects = projRows.map((p)=>({
      project_id: p.id,
      department: p.department,
      name: (p.parent_id && projName.get(p.parent_id) ? projName.get(p.parent_id) + ' > ' : '') + p.name,
      description: p.description || ''
    }));
  const context = {
    meeting_kind: 'leadership (all departments)',
    departments: DEPTS,
    meeting_title: tx.title,
    meeting_date: tx.meeting_date,
    open_tasks_numbered_list: openTasksNumbered,
    open_executive_decisions: decQ.data || [],
    roster: rosterQ.data || [],
    projects,
    note: 'Steel MacDonald and Suhaib are the co executive directors and are always valid owners.'
  };
  const result = await callAnthropic(context, tx.body);
  const changedBy = 'AI: ' + (tx.title || 'transcript ' + transcriptId);
  const nowIso = new Date().toISOString();
  const validProj = new Set(projRows.map((p)=>p.id));
  const counts = {
    updates: 0,
    tasks: 0,
    closed: 0,
    decisions: 0,
    decided: 0
  };
  const deptSet = new Set();
  for (const u of (Array.isArray(result.new_updates) ? result.new_updates : []).slice(0, 8)){
    const dept = String(u.department || '');
    const text = String(u.text || '').trim();
    if (DEPTS.indexOf(dept) < 0 || !text) continue;
    const { error: e1 } = await svc.from('dept_updates').insert({
      department: dept,
      entry_label: String(u.label || 'Leadership').slice(0, 60),
      text: text.slice(0, 2000),
      created_at: nowIso,
      added_by: changedBy,
      visibility: stampVis,
      allowed_people: stampPeople
    });
    if (!e1) {
      counts.updates++;
      deptSet.add(dept);
    }
  }
  for (const t of (Array.isArray(result.new_tasks) ? result.new_tasks : []).slice(0, 15)){
    const dept = String(t.department || '');
    const title = String(t.title || '').trim();
    if (DEPTS.indexOf(dept) < 0 || !title) continue;
    const pid = Number.isInteger(t.project_id) && validProj.has(t.project_id) ? t.project_id : null;
    const { error: e2 } = await svc.from('dept_tasks').insert({
      department: dept,
      title: title.slice(0, 300),
      owner: String(t.owner || '').slice(0, 120) || null,
      status: 'Open',
      done: false,
      opened_at: nowIso,
      updated_at: nowIso,
      updated_by: changedBy,
      due_date: typeof t.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date) ? t.due_date : null,
      flag: t.flag === true,
      reason_category: t.reason_category ? String(t.reason_category).slice(0, 120) : null,
      reason_note: t.reason_note ? String(t.reason_note).slice(0, 600) : null,
      confidential: t.confidential === true,
      project_id: pid,
      visibility: stampVis,
      allowed_people: stampPeople
    });
    if (!e2) {
      counts.tasks++;
      deptSet.add(dept);
      await svc.from('change_log').insert({
        entity_type: 'task',
        entity_id: title.slice(0, 120),
        field: 'created',
        old_value: null,
        new_value: dept,
        changed_by: changedBy
      });
    }
  }
  for (const c of (Array.isArray(result.close_tasks) ? result.close_tasks : []).slice(0, 10)){
    const taskId = Number(c.task_id);
    if (!Number.isInteger(taskId) || taskId <= 0) continue;
    const { data: task } = await svc.from('dept_tasks').select('id, done').eq('id', taskId).maybeSingle();
    if (!task || task.done !== false) continue;
    const { error: e3 } = await svc.from('dept_tasks').update({
      done: true,
      closed_at: nowIso,
      updated_at: nowIso,
      updated_by: changedBy,
      reason_note: String(c.evidence || '').slice(0, 600) || null
    }).eq('id', taskId).eq('done', false);
    if (!e3) {
      counts.closed++;
      await svc.from('change_log').insert({
        entity_type: 'task',
        entity_id: String(taskId),
        field: 'done',
        old_value: 'false',
        new_value: 'true (closed from leadership meeting)',
        changed_by: changedBy
      });
    }
  }
  for (const d of (Array.isArray(result.new_decisions) ? result.new_decisions : []).slice(0, 6)){
    const title = String(d.title || '').trim();
    if (!title) continue;
    const { error: e4 } = await svc.from('decisions').insert({
      title: title.slice(0, 300),
      area: String(d.area || '').slice(0, 120) || null,
      suggested_move: String(d.suggested_move || '').slice(0, 600) || null,
      owner: d.owner ? String(d.owner).slice(0, 60) : null,
      reason_category: String(d.reason_category || '').slice(0, 120) || null,
      reason_note: String(d.reason_note || '').slice(0, 600) || null,
      confidential: d.confidential === true,
      done: false,
      opened_at: nowIso,
      raised_by: changedBy,
      visibility: stampVis,
      allowed_people: stampPeople
    });
    if (!e4) counts.decisions++;
  }
  for (const d of (Array.isArray(result.decide_decisions) ? result.decide_decisions : []).slice(0, 6)){
    const id = Number(d.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    const { error: e5 } = await svc.from('decisions').update({
      done: true,
      decided_note: String(d.decided_note || '').slice(0, 600) || null,
      decided_at: nowIso,
      updated_by: changedBy,
      updated_at: nowIso
    }).eq('id', id).eq('done', false);
    if (!e5) counts.decided++;
  }
  const summary = String(result.summary || 'Leadership meeting processed.').slice(0, 500);
  await svc.from('transcripts').update({
    ai_summary: summary,
    processed: true,
    processed_at: nowIso
  }).eq('id', transcriptId);
  const dateStr = tx.meeting_date ? new Date(tx.meeting_date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  }) : 'recent';
  const isTest = /\[test\]/i.test(tx.title || '');
  /* v3 (29/09/26, wave162): a leadership meeting the Loom pull filed (added_by 'Loom pull ...') posts to Slack only when
     app_config loom_pull_slack is 'on' (off until Steel says otherwise), the same rule as process-transcript v15 */
  let loomQuiet = false;
  if (/^Loom pull/i.test(String(tx.added_by || ''))) {
    try {
      const { data: cfg } = await svc.from('app_config').select('value').eq('key', 'loom_pull_slack').maybeSingle();
      loomQuiet = String(cfg?.value || 'off').trim().toLowerCase() !== 'on';
    } catch (_) {
      loomQuiet = true;
    }
  }
  if (!isTest && !loomQuiet) {
    const countsLine = counts.updates + ' updates and ' + counts.tasks + ' tasks spread across ' + deptSet.size + ' departments, ' + counts.closed + ' tasks closed, ' + counts.decisions + ' new decisions.';
    if (restricted) {
      await postSlack(':large_green_circle: *Welfare Avenue Dashboard*\nA leadership meeting (' + dateStr + ') was processed: ' + countsLine + ' Details are visible to ' + (stampVis === 'private' ? 'the people on the meeting' : 'leaders and admins') + ' in the Hub.');
    } else {
      const site = await siteUrl();
      const deptLine = [
        ...deptSet
      ].map((d)=>DEPT_LABEL[d] || d).join(', ');
      await postSlack(':large_green_circle: *Welfare Avenue Dashboard*\n*Leadership meeting* (' + dateStr + ') processed: ' + countsLine + (deptLine ? '\nDepartments touched: ' + deptLine + '.' : '') + '\n' + summary + '\n<' + site + '#transcripts|Open the archive>');
    }
  }
  return {
    ...counts,
    visibility: stampVis || 'open'
  };
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: CORS
  });
  if (!await authorize(req)) return json({
    error: 'unauthorized'
  }, 401);
  const body = await req.json().catch(()=>({}));
  const transcriptId = Number(body.transcript_id);
  if (!transcriptId) return json({
    error: 'transcript_id required'
  }, 400);
  const work = processLeadership(transcriptId).catch(async (e)=>{
    console.error('leadership processing failed', e);
    await svc.from('transcripts').update({
      ai_summary: 'Leadership processing failed: ' + String(e.message || e).slice(0, 200)
    }).eq('id', transcriptId);
  });
  // @ts-ignore EdgeRuntime provided by Supabase edge runtime
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
    EdgeRuntime.waitUntil(work);
  } else {
    await work;
  }
  return json({
    accepted: true,
    transcript_id: transcriptId
  }, 202);
});
