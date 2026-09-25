// v9 (25/09/26): routed through the Hub model router (llm, task brain; Jev picks the model); create_task accepts project_id and priority from the editable confirmation card (wave116o); Program Development added to the departments.
// Welfare Avenue: ask (v8, 09/09/26)
// v8: open-model fallback. callModel tries the Anthropic chain first; if the
// call fails (for example the account is out of credits) and an
// OPENROUTER_API_KEY secret exists in the vault, the same request is
// translated to the OpenAI-compatible format and retried against open
// models on OpenRouter (OR_MODELS chain). With no OpenRouter key vaulted,
// behaviour is byte-identical to v7. The final forced-answer step also
// accepts a plain text reply (open models sometimes ignore forced tool
// choice). Everything else unchanged from v7.
// v7: Drive grounding (wa_drive_docs block). v6: restricted meetings.
// v5: organization knowledge. v4: confirmation-first actions.
// v3: write actions from chat (retired). v2: board_only tier. v1: grounded Q&A.
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
const OPEN_VIS = 'visibility.is.null,visibility.eq.department';
async function getSecret(name) {
  const { data } = await svc.rpc('get_secret', {
    secret_name: name
  });
  return data || null;
}
async function authorize(req) {
  try {
    const given = req.headers.get('x-wa-secret');
    if (given && given === await getSecret('WA_TRIGGER_SECRET')) return {
      ok: true,
      who: 'system',
      email: ''
    };
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
    if (email.endsWith('@welfareavenue.com')) return {
      ok: true,
      who: email.split('@')[0],
      email
    };
  }
  return {
    ok: false,
    who: '',
    email: ''
  };
}
const DEPTS = [
  'opsmtl',
  'progdev',
  'opsto',
  'marketing',
  'fundraising',
  'hr',
  'board'
];
const DEPT_LABELS = {
  opsmtl: 'Ops Montreal',
  progdev: 'Program Development',
  opsto: 'Ops Toronto',
  marketing: 'Marketing',
  fundraising: 'Fundraising and Grants',
  hr: 'Human Resources',
  board: 'Board'
};
const STOPWORDS = [
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'what',
  'whats',
  'when',
  'where',
  'which',
  'who',
  'whom',
  'why',
  'how',
  'do',
  'does',
  'did',
  'doing',
  'have',
  'has',
  'had',
  'having',
  'with',
  'from',
  'that',
  'this',
  'these',
  'those',
  'there',
  'here',
  'about',
  'into',
  'onto',
  'over',
  'under',
  'again',
  'then',
  'than',
  'them',
  'they',
  'their',
  'theirs',
  'our',
  'ours',
  'your',
  'yours',
  'his',
  'her',
  'hers',
  'its',
  'it',
  'i',
  'we',
  'you',
  'he',
  'she',
  'me',
  'my',
  'us',
  'to',
  'of',
  'in',
  'on',
  'at',
  'by',
  'for',
  'as',
  'up',
  'out',
  'off',
  'so',
  'if',
  'not',
  'no',
  'any',
  'all',
  'some',
  'can',
  'could',
  'should',
  'would',
  'will',
  'shall',
  'may',
  'might',
  'must',
  'happening',
  'happened',
  'happen',
  'going',
  'recently',
  'recent',
  'latest',
  'update',
  'updates',
  'status',
  'tell',
  'know',
  'anything',
  'something',
  'much',
  'many',
  'please',
  'request',
  'task'
];
function keywords(question) {
  return (question || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w)=>w.length > 2 && STOPWORDS.indexOf(w) < 0).slice(0, 8);
}
const ANSWER_TOOL = {
  name: 'answer_question',
  description: 'Return the answer or reply to the staff member. Always call this to finish.',
  input_schema: {
    type: 'object',
    properties: {
      answer: {
        type: 'string',
        description: 'The reply, grounded in the provided context, concise, plain text. When you proposed actions this turn, say what is ready and that they need to confirm it below; never claim it is already filed or done.'
      },
      sources: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'Short source references used. Empty if none.'
      }
    },
    required: [
      'answer',
      'sources'
    ]
  }
};
const CLOSE_TASK_TOOL = {
  name: 'close_task',
  description: 'PROPOSE closing (marking done) one open task, ONLY when the latest user message explicitly asks. task_id must be a numeric id from the OPEN TASKS list. The user will confirm before it happens.',
  input_schema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'integer'
      },
      note: {
        type: 'string'
      }
    },
    required: [
      'task_id'
    ]
  }
};
const COMPLETE_REQUEST_TOOL = {
  name: 'complete_request',
  description: 'PROPOSE marking one open request done, ONLY when the latest user message explicitly asks. request_id must be a numeric id from the OPEN REQUESTS list. The user will confirm before it happens.',
  input_schema: {
    type: 'object',
    properties: {
      request_id: {
        type: 'integer'
      }
    },
    required: [
      'request_id'
    ]
  }
};
const SET_REQUEST_STATUS_TOOL = {
  name: 'set_request_status',
  description: 'PROPOSE changing the status of one open request, ONLY when the latest user message explicitly asks. The user will confirm before it happens.',
  input_schema: {
    type: 'object',
    properties: {
      request_id: {
        type: 'integer'
      },
      status: {
        type: 'string'
      }
    },
    required: [
      'request_id',
      'status'
    ]
  }
};
const CREATE_REQUEST_TOOL = {
  name: 'create_request',
  description: 'PROPOSE filing a NEW request into the requests portal (any kind: recruiting someone, a purchase order, supplies, access, or anything else a department should action). Use when the user asks to put in, file, or make a request. Pick the best matching type_key from REQUEST TYPES in the context, or "other" if nothing fits. The user will confirm before it is filed.',
  input_schema: {
    type: 'object',
    properties: {
      type_key: {
        type: 'string',
        description: 'A key from REQUEST TYPES, or "other".'
      },
      department: {
        type: 'string',
        description: 'One of: opsmtl, progdev, opsto, marketing, fundraising, hr, board. The department that should action it.'
      },
      title: {
        type: 'string',
        description: 'Short, concrete title, e.g. "Recruit Melissa Chen as weekend volunteer coordinator".'
      },
      details: {
        type: 'string',
        description: 'The details the actioning team needs: who, what, why, any deadline the user gave. Do not invent specifics.'
      },
      assignee: {
        type: 'string',
        description: 'Optional: a team member name from TEAM MEMBERS if the user named who should handle it.'
      }
    },
    required: [
      'type_key',
      'department',
      'title',
      'details'
    ]
  }
};
const CREATE_TASK_TOOL = {
  name: 'create_task',
  description: 'PROPOSE adding a NEW task to a department board. Use when the user asks to add a task or put something on a board. The user will confirm before it is added.',
  input_schema: {
    type: 'object',
    properties: {
      department: {
        type: 'string',
        description: 'One of: opsmtl, progdev, opsto, marketing, fundraising, hr, board.'
      },
      title: {
        type: 'string',
        description: 'The task title, concrete and startable.'
      },
      detail: {
        type: 'string',
        description: 'Optional extra context for the task.'
      },
      owner: {
        type: 'string',
        description: 'Optional: a team member name from TEAM MEMBERS, only if the user named one.'
      },
      due_date: {
        type: 'string',
        description: 'Optional due date YYYY-MM-DD, only if the user gave one.'
      }
    },
    required: [
      'department',
      'title'
    ]
  }
};
const ACTION_TOOLS = [
  CLOSE_TASK_TOOL,
  COMPLETE_REQUEST_TOOL,
  SET_REQUEST_STATUS_TOOL,
  CREATE_REQUEST_TOOL,
  CREATE_TASK_TOOL
];
const MODELS = [
  'claude-sonnet-5',
  'claude-sonnet-4-5',
  'claude-sonnet-4-20250514'
];
const OR_MODELS = [
  'z-ai/glm-5.3',
  'deepseek/deepseek-v4-pro-0813',
  'qwen/qwen3.8-27b'
];
const SYSTEM = `You are the assistant for Welfare Avenue's staff Hub, a youth-powered charity in Montreal and Toronto run by co executive directors Steel and Suhaib. Answer ONLY from the provided context: if the context does not contain the answer, say what is missing and where to look. Be concise, under 180 words unless listing items. Cite sources inline like (Ops MTL meeting, Jul 13). When a document from the DRIVE DOCUMENTS block informs your answer, include its link so the reader can open the source in Google Drive. Never use em dashes anywhere; use commas, colons, or parentheses. Plain text only.

You can PROPOSE actions with the action tools: file a new request (create_request), add a task (create_task), close a task, complete a request, or change a request status. Nothing you propose happens immediately: the dashboard shows the user a confirmation card and the action only runs if they confirm. Propose an action ONLY when the latest user message asks for it. Draft titles and details faithfully from what the user said; never invent names, amounts, or dates they did not give. For ids, only use ids present in the context lists. In your final answer, tell the user what is ready to confirm below; never say it is already filed, added, closed, or done.

Always finish by calling answer_question.`;
async function anthropicCall(key, messages, tools, toolChoice) {
  let lastErr = '';
  for (const model of MODELS){
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'x-wa-task': 'brain',
        'x-wa-caller': 'ask',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        temperature: 0.2,
        system: SYSTEM,
        messages,
        tools,
        tool_choice: toolChoice
      })
    });
    if (res.ok) return await res.json();
    lastErr = res.status + ' ' + (await res.text()).slice(0, 200);
    if (res.status !== 404 && res.status !== 400) break;
  }
  throw new Error('model call failed: ' + lastErr);
}
function toOpenAITools(tools) {
  return (tools || []).map((t)=>{
    const tt = t;
    return {
      type: 'function',
      function: {
        name: tt.name || '',
        description: tt.description || '',
        parameters: tt.input_schema || {
          type: 'object',
          properties: {}
        }
      }
    };
  });
}
function toOpenAIToolChoice(tc) {
  const t = tc;
  if (t && t.type === 'tool' && t.name) return {
    type: 'function',
    function: {
      name: t.name
    }
  };
  return 'auto';
}
function toOpenAIMessages(system, messages) {
  const out = [
    {
      role: 'system',
      content: system
    }
  ];
  for (const m of messages){
    const mm = m;
    const role = mm.role === 'assistant' ? 'assistant' : 'user';
    if (typeof mm.content === 'string') {
      out.push({
        role,
        content: mm.content
      });
      continue;
    }
    if (!Array.isArray(mm.content)) continue;
    const blocks = mm.content;
    if (role === 'assistant') {
      const text = blocks.filter((b)=>b.type === 'text').map((b)=>String(b.text || '')).join('\n').trim();
      const toolCalls = blocks.filter((b)=>b.type === 'tool_use').map((b)=>({
          id: String(b.id || 'call_' + Math.random().toString(36).slice(2, 10)),
          type: 'function',
          function: {
            name: String(b.name || ''),
            arguments: JSON.stringify(b.input || {})
          }
        }));
      const msg = {
        role: 'assistant',
        content: text || null
      };
      if (toolCalls.length) msg.tool_calls = toolCalls;
      out.push(msg);
    } else {
      for (const b of blocks){
        if (b.type === 'tool_result') {
          out.push({
            role: 'tool',
            tool_call_id: String(b.tool_use_id || ''),
            content: typeof b.content === 'string' ? b.content : JSON.stringify(b.content || '')
          });
        }
      }
    }
  }
  return out;
}
function fromOpenAI(msg) {
  const blocks = [];
  if (typeof msg.content === 'string' && msg.content.trim()) blocks.push({
    type: 'text',
    text: msg.content
  });
  for (const tc of Array.isArray(msg.tool_calls) ? msg.tool_calls : []){
    let input = {};
    try {
      input = JSON.parse(tc.function && tc.function.arguments || '{}');
    } catch (_) {
      input = {};
    }
    blocks.push({
      type: 'tool_use',
      id: tc.id || 'call_' + Math.random().toString(36).slice(2, 10),
      name: tc.function && tc.function.name || '',
      input
    });
  }
  return blocks;
}
async function openrouterCall(orKey, messages, tools, toolChoice) {
  let lastErr = '';
  const body = {
    max_tokens: 1200,
    temperature: 0.2,
    messages: toOpenAIMessages(SYSTEM, messages),
    tools: toOpenAITools(tools),
    tool_choice: toOpenAIToolChoice(toolChoice)
  };
  for (const model of OR_MODELS){
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + orKey,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://wa-exec-dashboard.netlify.app',
        'X-Title': 'WA Hub'
      },
      body: JSON.stringify({
        model,
        ...body
      })
    });
    if (res.ok) {
      const j = await res.json();
      const msg = j && j.choices && j.choices[0] && j.choices[0].message;
      if (msg) return {
        content: fromOpenAI(msg)
      };
      lastErr = model + ': empty choices';
      continue;
    }
    lastErr = model + ': ' + res.status + ' ' + (await res.text()).slice(0, 200);
  }
  throw new Error('fallback model call failed: ' + lastErr);
}
async function callModel(key, orKey, messages, tools, toolChoice) {
  if (key) {
    try {
      return await anthropicCall(key, messages, tools, toolChoice);
    } catch (e) {
      if (!orKey) throw e;
    }
  } else if (!orKey) {
    throw new Error('no model API key configured');
  }
  return await openrouterCall(orKey, messages, tools, toolChoice);
}
function summarize(name, input) {
  if (name === 'create_request') return 'File a request to ' + (DEPT_LABELS[String(input.department)] || input.department) + ': ' + input.title + (input.assignee ? ' (for ' + input.assignee + ')' : '');
  if (name === 'create_task') return 'Add a task to ' + (DEPT_LABELS[String(input.department)] || input.department) + ': ' + input.title + (input.owner ? ' (owner: ' + input.owner + ')' : '') + (input.due_date ? ', due ' + input.due_date : '');
  if (name === 'close_task') return 'Close task #' + input.task_id;
  if (name === 'complete_request') return 'Mark request #' + input.request_id + ' as done';
  if (name === 'set_request_status') return 'Set request #' + input.request_id + ' to "' + input.status + '"';
  return name;
}
// ---- executors (run ONLY on the confirmed execute path) ----
async function doCloseTask(input, caller, isBoard) {
  const taskId = Number(input?.task_id);
  if (!Number.isInteger(taskId) || taskId <= 0) return {
    error: 'invalid task_id'
  };
  const { data: task, error: fetchErr } = await svc.from('dept_tasks').select('id, title, done, board_only').eq('id', taskId).maybeSingle();
  if (fetchErr || !task) return {
    error: 'task not found'
  };
  if (task.done !== false) return {
    error: 'task is already closed'
  };
  if (task.board_only === true && !isBoard) return {
    error: 'not permitted'
  };
  const note = typeof input?.note === 'string' ? input.note.slice(0, 300) : '';
  const by = 'Chat (' + caller + ')';
  const nowIso = new Date().toISOString();
  const { error: updErr } = await svc.from('dept_tasks').update({
    done: true,
    closed_at: nowIso,
    updated_at: nowIso,
    updated_by: by
  }).eq('id', taskId).eq('done', false);
  if (updErr) return {
    error: 'update failed: ' + updErr.message
  };
  await svc.from('change_log').insert({
    entity_type: 'task',
    entity_id: String(taskId),
    field: 'done',
    old_value: 'false',
    new_value: 'true' + (note ? ' ' + note : ''),
    changed_by: by,
    board_only: task.board_only === true
  });
  return {
    ok: true,
    detail: 'Closed task: ' + task.title
  };
}
async function doCompleteRequest(input, caller) {
  const requestId = Number(input?.request_id);
  if (!Number.isInteger(requestId) || requestId <= 0) return {
    error: 'invalid request_id'
  };
  const { data: reqRow, error: fetchErr } = await svc.from('dept_requests').select('id, title, done').eq('id', requestId).maybeSingle();
  if (fetchErr || !reqRow) return {
    error: 'request not found'
  };
  if (reqRow.done !== false) return {
    error: 'request is already done'
  };
  const by = 'Chat (' + caller + ')';
  const nowIso = new Date().toISOString();
  const { error: updErr } = await svc.from('dept_requests').update({
    done: true,
    done_at: nowIso,
    updated_at: nowIso,
    updated_by: by
  }).eq('id', requestId).eq('done', false);
  if (updErr) return {
    error: 'update failed: ' + updErr.message
  };
  await svc.from('change_log').insert({
    entity_type: 'request',
    entity_id: String(requestId),
    field: 'done',
    old_value: 'false',
    new_value: 'true',
    changed_by: by
  });
  return {
    ok: true,
    detail: 'Completed request: ' + reqRow.title
  };
}
async function doSetRequestStatus(input, caller) {
  const requestId = Number(input?.request_id);
  if (!Number.isInteger(requestId) || requestId <= 0) return {
    error: 'invalid request_id'
  };
  let newStatus = String(input?.status || '').trim().slice(0, 100);
  if (!newStatus) return {
    error: 'status required'
  };
  const { data: reqRow, error: fetchErr } = await svc.from('dept_requests').select('id, title, done, status, type_key').eq('id', requestId).maybeSingle();
  if (fetchErr || !reqRow) return {
    error: 'request not found'
  };
  if (reqRow.done !== false) return {
    error: 'request is already done'
  };
  const { data: rt } = await svc.from('request_types').select('statuses').eq('key', reqRow.type_key).maybeSingle();
  const statuses = Array.isArray(rt?.statuses) ? rt.statuses.filter((s)=>typeof s === 'string') : [];
  if (statuses.length) {
    const match = statuses.find((s)=>s.toLowerCase() === newStatus.toLowerCase());
    if (!match) return {
      error: 'invalid status. Valid statuses: ' + statuses.join(', ')
    };
    newStatus = match;
  }
  const by = 'Chat (' + caller + ')';
  const { error: updErr } = await svc.from('dept_requests').update({
    status: newStatus,
    updated_at: new Date().toISOString(),
    updated_by: by
  }).eq('id', requestId).eq('done', false);
  if (updErr) return {
    error: 'update failed: ' + updErr.message
  };
  await svc.from('change_log').insert({
    entity_type: 'request',
    entity_id: String(requestId),
    field: 'status',
    old_value: reqRow.status || null,
    new_value: newStatus,
    changed_by: by
  });
  return {
    ok: true,
    detail: 'Set request (' + reqRow.title + ') status to ' + newStatus
  };
}
async function doCreateRequest(input, caller) {
  const title = String(input?.title || '').trim().slice(0, 200);
  const details = String(input?.details || '').trim().slice(0, 2000);
  let department = String(input?.department || '').trim();
  let typeKey = String(input?.type_key || 'other').trim().slice(0, 60) || 'other';
  if (!title) return {
    error: 'title required'
  };
  if (DEPTS.indexOf(department) < 0) return {
    error: 'invalid department'
  };
  let status = 'requested';
  const { data: rt } = await svc.from('request_types').select('key, department, default_status, default_assignee').eq('key', typeKey).maybeSingle();
  if (!rt) typeKey = 'other';
  if (rt?.default_status) status = String(rt.default_status);
  const assignee = typeof input?.assignee === 'string' && input.assignee.trim() ? String(input.assignee).trim().slice(0, 80) : rt?.default_assignee || null;
  const by = 'Chat (' + caller + ')';
  const { data: ins, error: insErr } = await svc.from('dept_requests').insert({
    type_key: typeKey,
    department,
    title,
    details: details || null,
    status,
    done: false,
    requested_by: by,
    assignee
  }).select('id').single();
  if (insErr) return {
    error: 'insert failed: ' + insErr.message
  };
  await svc.from('change_log').insert({
    entity_type: 'request',
    entity_id: String(ins.id),
    field: 'created',
    old_value: null,
    new_value: title,
    changed_by: by
  });
  return {
    ok: true,
    id: ins.id,
    detail: 'Filed request #' + ins.id + ' to ' + (DEPT_LABELS[department] || department) + ': ' + title
  };
}
async function doCreateTask(input, caller) {
  const title = String(input?.title || '').trim().slice(0, 250);
  const department = String(input?.department || '').trim();
  if (!title) return {
    error: 'title required'
  };
  if (DEPTS.indexOf(department) < 0) return {
    error: 'invalid department'
  };
  const owner = typeof input?.owner === 'string' && input.owner.trim() ? String(input.owner).trim().slice(0, 80) : null;
  const due = typeof input?.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(String(input.due_date)) ? String(input.due_date) : null;
  const detail = typeof input?.detail === 'string' && input.detail.trim() ? String(input.detail).trim().slice(0, 1000) : null;
  // wave116o: the confirmation card can set a project and priority
  let projectId = null;
  if (input?.project_id && Number.isInteger(Number(input.project_id))) {
    const { data: pr } = await svc.from('projects').select('id, department').eq('id', Number(input.project_id)).maybeSingle();
    if (pr && (!pr.department || pr.department === department)) projectId = pr.id;
  }
  const priority = input?.priority === true;
  const by = 'Chat (' + caller + ')';
  const { data: ins, error: insErr } = await svc.from('dept_tasks').insert({
    department,
    title,
    owner,
    status: 'Open',
    due_date: due,
    done: false,
    flag: false,
    priority,
    project_id: projectId,
    sort: 999,
    reason_note: detail ? 'From the chat: ' + detail : 'Added from the chat assistant',
    updated_by: by,
    opened_at: new Date().toISOString()
  }).select('id').single();
  if (insErr) return {
    error: 'insert failed: ' + insErr.message
  };
  await svc.from('change_log').insert({
    entity_type: 'task',
    entity_id: String(ins.id),
    field: 'created',
    old_value: null,
    new_value: title,
    changed_by: by
  });
  return {
    ok: true,
    id: ins.id,
    detail: 'Added task #' + ins.id + ' to ' + (DEPT_LABELS[department] || department) + ': ' + title + (owner ? ' (owner: ' + owner + ')' : '')
  };
}
async function execAction(name, input, caller, isBoard) {
  try {
    if (name === 'close_task') return await doCloseTask(input, caller, isBoard);
    if (name === 'complete_request') return await doCompleteRequest(input, caller);
    if (name === 'set_request_status') return await doSetRequestStatus(input, caller);
    if (name === 'create_request') return await doCreateRequest(input, caller);
    if (name === 'create_task') return await doCreateTask(input, caller);
    return {
      error: 'unknown action ' + name
    };
  } catch (e) {
    return {
      error: String(e)
    };
  }
}
function pickAnswer(content) {
  const tu = content.find((c)=>c.type === 'tool_use' && c.name === 'answer_question');
  if (!tu?.input) return null;
  const inp = tu.input;
  return {
    answer: typeof inp.answer === 'string' ? inp.answer : String(inp.answer || ''),
    sources: Array.isArray(inp.sources) ? inp.sources.filter((s)=>typeof s === 'string').slice(0, 10) : []
  };
}
async function runAgent(history, context, question) {
  const key = 'hub-router';
  const orKey = await getSecret('OPENROUTER_API_KEY');
  if (!key && !orKey) throw new Error('no model API key configured');
  const finalUser = 'CONTEXT FROM THE DASHBOARD DATABASE:\n\n' + context.slice(0, 30000) + '\n\nQUESTION: ' + question;
  const messages = [
    ...history,
    {
      role: 'user',
      content: finalUser
    }
  ];
  const allTools = [
    ANSWER_TOOL,
    ...ACTION_TOOLS
  ];
  const proposals = [];
  for(let round = 0; round < 2; round++){
    const body = await callModel(key, orKey, messages, allTools, {
      type: 'auto'
    });
    const content = body.content || [];
    const actions = content.filter((c)=>c.type === 'tool_use' && c.name !== 'answer_question');
    if (!actions.length) {
      const ans = pickAnswer(content);
      if (ans) return {
        ...ans,
        proposals
      };
      break;
    }
    const results = [];
    for (const block of content){
      if (block.type !== 'tool_use') continue;
      if (block.name === 'answer_question') {
        results.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: 'Noted. Give the final answer again after the proposals are captured.'
        });
        continue;
      }
      if (proposals.length >= 4) {
        results.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify({
            error: 'proposal limit reached for this message'
          }),
          is_error: true
        });
        continue;
      }
      const input = block.input || {};
      proposals.push({
        name: String(block.name),
        input,
        summary: summarize(String(block.name), input)
      });
      results.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: 'Captured as a pending action. The user will see a confirmation card in the dashboard and it only runs if they confirm. Do not describe it as done; tell them it is ready to confirm below.'
      });
    }
    messages.push({
      role: 'assistant',
      content
    }, {
      role: 'user',
      content: results
    });
  }
  const body = await callModel(key, orKey, messages, [
    ANSWER_TOOL
  ], {
    type: 'tool',
    name: 'answer_question'
  });
  const content = body.content || [];
  const ans = pickAnswer(content);
  if (ans) return {
    ...ans,
    proposals
  };
  // Open models sometimes ignore a forced tool choice and reply in plain text.
  const txt = content.filter((c)=>c.type === 'text' && typeof c.text === 'string').map((c)=>c.text).join('\n').trim();
  if (txt) return {
    answer: txt,
    sources: [],
    proposals
  };
  throw new Error('no final answer returned');
}
function cleanHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const turns = [];
  for (const t of raw.slice(-6)){
    if (!t || typeof t !== 'object') continue;
    const role = t.role;
    const content = t.content;
    if ((role === 'user' || role === 'assistant') && typeof content === 'string' && content.trim()) {
      turns.push({
        role,
        content: content.slice(0, 2000)
      });
    }
  }
  while(turns.length && turns[0].role !== 'user')turns.shift();
  return turns;
}
async function buildContext(question, isBoard) {
  const kws = keywords(question);
  const parts = [];
  try {
    if (kws.length) {
      let ftsQ = svc.from('transcripts').select('id,title,meeting_date,department,ai_summary').or(OPEN_VIS).textSearch('fts', kws.join(' '), {
        type: 'websearch'
      });
      if (!isBoard) ftsQ = ftsQ.eq('board_only', false);
      const { data: hits } = await ftsQ.order('meeting_date', {
        ascending: false
      }).limit(6);
      if (hits && hits.length) {
        parts.push('MEETINGS MATCHING THE QUESTION:\n' + hits.map((h)=>'- ' + (h.title || 'Untitled') + ' (' + (DEPT_LABELS[h.department] || h.department || '') + ', ' + (h.meeting_date || '') + '): ' + (h.ai_summary || '').slice(0, 900)).join('\n'));
      }
    }
  } catch (_) {}
  try {
    let recentQ = svc.from('transcripts').select('title,meeting_date,department,ai_summary').or(OPEN_VIS);
    if (!isBoard) recentQ = recentQ.eq('board_only', false);
    const { data: recent } = await recentQ.order('meeting_date', {
      ascending: false
    }).limit(3);
    if (recent && recent.length) {
      parts.push('MOST RECENT MEETINGS:\n' + recent.map((h)=>'- ' + (h.title || 'Untitled') + ' (' + (DEPT_LABELS[h.department] || h.department || '') + ', ' + (h.meeting_date || '') + '): ' + (h.ai_summary || '').slice(0, 700)).join('\n'));
    }
  } catch (_) {}
  try {
    let decQ = svc.from('decisions').select('title,area,owner,suggested_move,recommendation').eq('done', false).or(OPEN_VIS);
    if (!isBoard) decQ = decQ.eq('board_only', false);
    const { data: decs } = await decQ.limit(20);
    if (decs && decs.length) {
      parts.push('OPEN EXECUTIVE DECISIONS:\n' + decs.map((d)=>'- ' + d.title + ' (area: ' + (d.area || 'unknown') + ', owner: ' + (d.owner || 'Steel and Suhaib') + ')').join('\n'));
    }
  } catch (_) {}
  try {
    let openQ = svc.from('dept_tasks').select('department,flag').eq('done', false).or(OPEN_VIS);
    if (!isBoard) openQ = openQ.eq('board_only', false);
    const { data: openTasks } = await openQ.limit(1000);
    if (openTasks && openTasks.length) {
      const counts = DEPTS.map((d)=>{
        const rows = openTasks.filter((t)=>t.department === d);
        if (!rows.length) return null;
        const flagged = rows.filter((t)=>!!t.flag).length;
        return DEPT_LABELS[d] + ': ' + rows.length + ' open' + (flagged ? ' (' + flagged + ' flagged)' : '');
      }).filter(Boolean);
      if (counts.length) parts.push('OPEN TASKS BY DEPARTMENT: ' + counts.join('; '));
    }
    if (kws.length) {
      const orFilter = kws.map((k)=>'title.ilike.%' + k + '%').join(',');
      let matchedQ = svc.from('dept_tasks').select('id,department,subsection,title,owner,status,flag,priority,due_date').eq('done', false).or(OPEN_VIS).or(orFilter);
      if (!isBoard) matchedQ = matchedQ.eq('board_only', false);
      const { data: matched } = await matchedQ.order('id', {
        ascending: false
      }).limit(8);
      if (matched && matched.length) {
        parts.push('OPEN TASKS MATCHING THE QUESTION (numeric ids usable with close_task):\n' + matched.map((t)=>t.id + '. ' + t.title + ' (' + (DEPT_LABELS[t.department] || t.department) + ', owner: ' + (t.owner || 'unowned') + ', status: ' + (t.status || 'open') + ')').join('\n'));
      }
    }
  } catch (_) {}
  try {
    const { data: reqs } = await svc.from('dept_requests').select('id,title,department,status,type_key,requested_by,created_at').eq('done', false).order('created_at', {
      ascending: false
    }).limit(20);
    if (reqs && reqs.length) {
      parts.push('OPEN REQUESTS (ids usable with complete_request and set_request_status):\n' + reqs.map((r)=>r.id + '. ' + (r.title || 'Untitled') + ' (' + (DEPT_LABELS[r.department] || r.department) + ', status: ' + (r.status || 'unknown') + ', type: ' + (r.type_key || '') + ')').join('\n'));
    }
  } catch (_) {}
  try {
    const { data: types } = await svc.from('request_types').select('key,label,department,description,default_assignee').eq('enabled', true).order('sort');
    if (types && types.length) {
      parts.push('REQUEST TYPES (for create_request type_key):\n' + types.map((t)=>'- ' + t.key + ': ' + (t.label || t.key) + ' (goes to ' + (DEPT_LABELS[t.department] || t.department) + (t.default_assignee ? ', usually handled by ' + t.default_assignee : '') + ')' + (t.description ? ' ' + String(t.description).slice(0, 120) : '')).join('\n'));
    }
  } catch (_) {}
  try {
    const { data: members } = await svc.from('team_members').select('name,department,role').eq('active', true).order('department');
    if (members && members.length) {
      parts.push('TEAM MEMBERS (names usable as owner or assignee):\n' + DEPTS.map((d)=>{
        const rows = (members || []).filter((m)=>m.department === d);
        return rows.length ? (DEPT_LABELS[d] || d) + ': ' + rows.map((m)=>m.name + (m.role ? ' (' + String(m.role).slice(0, 40) + ')' : '')).join(', ') : null;
      }).filter(Boolean).join('\n'));
    }
  } catch (_) {}
  try {
    const { data: metas } = await svc.from('dept_meta').select('department,progress,priorities');
    if (metas && metas.length) {
      parts.push('DEPARTMENT STATE:\n' + metas.map((m)=>'- ' + (DEPT_LABELS[m.department] || m.department) + ': ' + (m.progress || '').slice(0, 200)).join('\n'));
    }
  } catch (_) {}
  try {
    if (kws.length) {
      const nameFilter = kws.map((k)=>'name.ilike.%' + k + '%').join(',');
      const textFilter = kws.map((k)=>'text_content.ilike.%' + k + '%').join(',');
      const { data: docs } = await svc.from('wa_drive_docs').select('name,url,mime,modified_time,text_content').or(nameFilter + ',' + textFilter).order('modified_time', {
        ascending: false
      }).limit(5);
      if (docs && docs.length) {
        parts.push('DRIVE DOCUMENTS (organization documents in Google Drive; when one informs your answer, include its link):\n' + docs.map((d)=>{
          let snip = '';
          const t = d.text_content || '';
          if (t) {
            let at = -1;
            const tl = t.toLowerCase();
            for (const k of kws){
              const i = tl.indexOf(k);
              if (i >= 0) {
                at = i;
                break;
              }
            }
            snip = (at >= 0 ? t.slice(Math.max(0, at - 200), at + 1000) : t.slice(0, 900)).replace(/\s+/g, ' ');
          }
          return '## ' + d.name + (d.modified_time ? ' (updated ' + String(d.modified_time).slice(0, 10) + ')' : '') + '\nLink: ' + (d.url || '') + (snip ? '\n' + snip.slice(0, 1200) : '');
        }).join('\n\n'));
      }
    }
  } catch (_) {}
  try {
    const { data: kb } = await svc.from('hub_knowledge').select('title,body').order('updated_at', {
      ascending: false
    }).limit(4);
    if (kb && kb.length) {
      parts.push('ORGANIZATION KNOWLEDGE (strategy and reference documents):\n' + kb.map((k)=>'## ' + (k.title || '') + '\n' + (k.body || '').slice(0, 7000)).join('\n\n'));
    }
  } catch (_) {}
  return parts.join('\n\n').slice(0, 30000);
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: CORS
  });
  const auth = await authorize(req);
  if (!auth.ok) return json({
    error: 'unauthorized'
  }, 401);
  const body = await req.json().catch(()=>({}));
  let isBoard = false;
  try {
    if (auth.email) {
      const { data: bc } = await svc.from('board_circle').select('email');
      isBoard = !!(bc || []).find((r)=>(r.email || '').toLowerCase() === auth.email);
    }
  } catch (_) {
    isBoard = false;
  }
  if (body.execute && typeof body.execute === 'object') {
    const name = String(body.execute.name || '');
    const input = body.execute.input || {};
    const out = await execAction(name, input, auth.who, isBoard);
    return json({
      executed: out
    });
  }
  const question = typeof body.question === 'string' ? body.question.trim().slice(0, 1000) : '';
  if (!question) return json({
    error: 'question required'
  }, 400);
  const history = cleanHistory(body.history);
  try {
    const context = await buildContext(question, isBoard);
    const out = await runAgent(history, context || 'No matching data was found in the dashboard database for this question.', question);
    return json({
      answer: out.answer,
      sources: out.sources,
      proposals: out.proposals,
      actions_done: 0
    });
  } catch (e) {
    return json({
      error: String(e)
    }, 500);
  }
});
