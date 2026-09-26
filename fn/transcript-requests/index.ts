// wave132 (26/09/26): leaves out what is in the bank (tasks and projects parked for three months or more carry banked_at until they come back).
// Welfare Avenue: transcript-requests (v6, 04/08/26)
// v6: leadership meetings can be OPEN (visibility department/none while
// the department field says Leadership). The leadership treatment
// (spread across departments, up to 8 suggestions) now keys off the
// department field too, not just visibility.
// v5: leadership meetings are scanned and their suggestions spread across
// all departments (only 'private' meetings stay unscanned). Request types
// now ship their full routing descriptions to the model. Duplicate asks
// become 'refine' suggestions attached to the existing open request
// instead of new ones. Two new passes: goal wins (progress on quarterly
// goals, filed under the goal) and mentions (roster members discussed in
// a meeting they did not attend get a heads up on their home page).
// v4: restricted meetings. v3: due dates. v2: task comments. v1: requests.
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
const DEPTS = [
  'opsmtl',
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
const REQ_TOOL = {
  name: 'suggest_requests',
  description: 'Return the cross-team requests explicitly made in this meeting. Empty array if none.',
  input_schema: {
    type: 'object',
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            kind: {
              type: 'string',
              enum: [
                'new',
                'refine'
              ],
              description: '"new" for a request not yet tracked. "refine" when the ask matches an OPEN REQUEST: the details then refine or update that existing request instead of duplicating it.'
            },
            target_request_id: {
              type: [
                'integer',
                'null'
              ],
              description: 'Only for kind "refine": the numeric id from the OPEN REQUESTS list this refines. Never invent ids.'
            },
            type_key: {
              type: 'string',
              description: 'Best matching key from REQUEST TYPES, or "other".'
            },
            department: {
              type: 'string',
              description: 'The department that should ACTION it: opsmtl, opsto, marketing, fundraising, hr, or board. Default to the request type\'s actioned-by department unless the meeting clearly assigns another team.'
            },
            title: {
              type: 'string',
              description: 'Short concrete title of what is being requested.'
            },
            details: {
              type: 'string',
              description: 'Who asked, what exactly they need, any deadline mentioned. Only facts from the transcript. For "refine": what to add or change on the existing request.'
            },
            assignee: {
              type: 'string',
              description: 'Only if the meeting named who should handle it.'
            },
            confidence: {
              type: 'integer',
              description: '1 to 10: how clearly this was an actual request for another team to act (10 = stated verbatim).'
            },
            quote: {
              type: 'string',
              description: 'A short verbatim quote (under 200 chars) from the transcript that contains the ask.'
            }
          },
          required: [
            'kind',
            'type_key',
            'department',
            'title',
            'details',
            'confidence',
            'quote'
          ]
        }
      }
    },
    required: [
      'suggestions'
    ]
  }
};
const REQ_SYSTEM = 'You extract cross-team REQUESTS from Welfare Avenue meeting transcripts. A request is one team explicitly asking another team to do or provide something concrete (a post, a design, printing, event coverage, a purchase, supplies, transport, access, a recruit, consent language, grant information). Be conservative: only include asks that were clearly made, not ideas, updates, or tasks a team gave itself. Routing: each REQUEST TYPE lists the department that actions it and a description of what belongs to it; route each ask to the type and department that would action it, and only override the department when the meeting clearly assigns another team (transportation goes to the operations city concerned). Duplicates: when an ask matches an OPEN REQUEST, return kind "refine" with that request\'s id and put only the new information in details; never file a duplicate. For DEPARTMENT meetings return at most 3 suggestions. For LEADERSHIP meetings (leaders of every department present) asks routinely span departments: route each one to the department that actions it, spread them accordingly, and return at most 8. If nothing qualifies, return an empty array. Use only facts from the transcript; never invent names, amounts, or dates. No em dashes anywhere in your text.';
const CMT_TOOL = {
  name: 'attach_task_comments',
  description: 'Return progress comments for OPEN TASKS that this meeting clearly discussed. Empty array if none.',
  input_schema: {
    type: 'object',
    properties: {
      comments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            task_id: {
              type: 'integer',
              description: 'A numeric id from the OPEN TASKS list. Never invent ids.'
            },
            comment: {
              type: 'string',
              description: 'One or two sentences of what the meeting said about this task: progress, blockers, decisions, new deadline. Facts only.'
            },
            confidence: {
              type: 'integer',
              description: '1 to 10: how certain the discussion was about THIS exact task (10 = task mentioned near verbatim).'
            },
            quote: {
              type: 'string',
              description: 'A short verbatim quote (under 200 chars) supporting the comment.'
            }
          },
          required: [
            'task_id',
            'comment',
            'confidence',
            'quote'
          ]
        }
      }
    },
    required: [
      'comments'
    ]
  }
};
const CMT_SYSTEM = 'You attach progress notes from a Welfare Avenue meeting or Slack digest to the organization\'s existing OPEN TASKS. Only comment on a task when the discussion is clearly about that specific task (same work, not just the same topic area). Each comment is a factual note: progress made, blockers, decisions, or timing changes. This also prevents duplicates: when a meeting re-raises work an open task already covers, the right move is a comment on that task, not a new task. Maximum 5 per meeting. Never invent facts, names, or dates; never comment on a task the text does not clearly discuss. If nothing qualifies, return an empty array. No em dashes anywhere in your text.';
const DUE_TOOL = {
  name: 'suggest_due_dates',
  description: 'Return due date suggestions for tasks in the TASKS WITHOUT DUE DATES list whose timing this meeting clearly stated. Empty array if none.',
  input_schema: {
    type: 'object',
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            task_id: {
              type: 'integer',
              description: 'A numeric id from the TASKS WITHOUT DUE DATES list. Never invent ids.'
            },
            due_date: {
              type: 'string',
              description: 'The concrete date implied, as YYYY-MM-DD. Resolve relative phrases ("by Friday", "end of month") against the MEETING DATE.'
            },
            confidence: {
              type: 'integer',
              description: '1 to 10: how clearly the meeting tied THIS timing to THIS exact task (10 = deadline stated verbatim for the task).'
            },
            quote: {
              type: 'string',
              description: 'A short verbatim quote (under 200 chars) containing the timing statement.'
            }
          },
          required: [
            'task_id',
            'due_date',
            'confidence',
            'quote'
          ]
        }
      }
    },
    required: [
      'suggestions'
    ]
  }
};
const DUE_SYSTEM = 'You extract DUE DATES from a Welfare Avenue meeting or Slack digest for existing tasks that have no due date yet. Only suggest a date when the discussion clearly states timing for that specific task: an explicit deadline, an event date the task must precede, or a clear relative phrase like "by Friday" or "before the August event". Resolve every relative phrase against the MEETING DATE given in the header. Be conservative: no date for vague urgency ("soon", "ASAP"). Maximum 5 per meeting. Never invent dates; never suggest for a task the text does not clearly discuss. If nothing qualifies, return an empty array. No em dashes anywhere in your text.';
const WIN_TOOL = {
  name: 'record_goal_wins',
  description: 'Return concrete progress this meeting reports against the QUARTERLY GOALS list. Empty array if none.',
  input_schema: {
    type: 'object',
    properties: {
      wins: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            goal_id: {
              type: 'integer',
              description: 'A numeric id from the QUARTERLY GOALS list. Never invent ids.'
            },
            win: {
              type: 'string',
              description: 'One sentence of concrete, completed or measurable progress toward that goal. Facts only.'
            },
            confidence: {
              type: 'integer',
              description: '1 to 10: how clearly the meeting reported real progress on THIS goal (10 = stated verbatim).'
            },
            quote: {
              type: 'string',
              description: 'A short verbatim quote (under 200 chars) supporting the win.'
            }
          },
          required: [
            'goal_id',
            'win',
            'confidence',
            'quote'
          ]
        }
      }
    },
    required: [
      'wins'
    ]
  }
};
const WIN_SYSTEM = 'You record WINS against Welfare Avenue\'s quarterly goals from a meeting transcript. A win is concrete, completed or measurable progress toward a listed goal: something shipped, signed, recruited, published, raised, launched, or a stated metric moving. Not plans, intentions, or work merely assigned. Match the win to the specific goal it advances; when no listed goal fits, skip it. Maximum 4 per meeting. Never invent facts or numbers. If nothing qualifies, return an empty array. No em dashes anywhere in your text.';
const MEN_TOOL = {
  name: 'record_mentions',
  description: 'Return roster members who were meaningfully mentioned in this meeting but were NOT among its speakers. Empty array if none.',
  input_schema: {
    type: 'object',
    properties: {
      mentions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            person: {
              type: 'string',
              description: 'The exact full name from the ROSTER list. Never invent names.'
            },
            context: {
              type: 'string',
              description: 'One sentence: why they came up and anything expected of them. Facts only.'
            },
            confidence: {
              type: 'integer',
              description: '1 to 10: how clearly this roster member (not a similarly named person) was discussed (10 = full name used).'
            },
            quote: {
              type: 'string',
              description: 'A short verbatim quote (under 200 chars) containing the mention.'
            }
          },
          required: [
            'person',
            'context',
            'confidence',
            'quote'
          ]
        }
      }
    },
    required: [
      'mentions'
    ]
  }
};
const MEN_SYSTEM = 'You find Welfare Avenue roster members who were meaningfully MENTIONED in a meeting they did not attend, so they can be kept in the loop. Meaningful means work was assigned to or expected of them, their work was discussed, or a decision affects them; a passing name drop does not count. Only use exact names from the ROSTER. Skip anyone listed as a SPEAKER or clearly present in the conversation, and skip the uploader. Maximum 5 per meeting. Never invent context. If nothing qualifies, return an empty array. No em dashes anywhere in your text.';
async function callModel(key, system, user, tool, toolName) {
  let lastErr = '';
  for (const model of MODELS){
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 1800,
        temperature: 0,
        system,
        messages: [
          {
            role: 'user',
            content: user
          }
        ],
        tools: [
          tool
        ],
        tool_choice: {
          type: 'tool',
          name: toolName
        }
      })
    });
    if (res.ok) return await res.json();
    lastErr = res.status + ' ' + (await res.text()).slice(0, 200);
    if (res.status !== 404 && res.status !== 400) break;
  }
  throw new Error('model call failed: ' + lastErr);
}
function toolItems(body, name, field) {
  const tu = (body.content || []).find((c)=>c.type === 'tool_use' && c.name === name);
  const arr = tu && tu.input && Array.isArray(tu.input[field]) ? tu.input[field] : [];
  return arr.map((x)=>x);
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: CORS
  });
  if (!await authorize(req)) return json({
    error: 'unauthorized'
  }, 401);
  const key = await getSecret('ANTHROPIC_API_KEY');
  if (!key) return json({
    error: 'ANTHROPIC_API_KEY missing'
  }, 500);
  const { data: scanned } = await svc.from('transcript_request_scans').select('transcript_id');
  const done = new Set((scanned || []).map((s)=>s.transcript_id));
  const { data: txs } = await svc.from('transcripts').select('id,title,department,meeting_date,body,ai_summary,board_only,added_by,visibility,speakers').not('ai_summary', 'is', null).order('id', {
    ascending: false
  }).limit(60);
  const fresh = (txs || []).filter((t)=>!done.has(t.id));
  const restricted = fresh.filter((t)=>t.visibility === 'private');
  for (const t of restricted){
    await svc.from('transcript_request_scans').upsert({
      transcript_id: t.id,
      n_found: 0,
      scanned_at: new Date().toISOString()
    });
  }
  const todo = fresh.filter((t)=>restricted.indexOf(t) < 0).slice(0, 5);
  if (!todo.length) return json({
    scanned: 0,
    requests: 0,
    comments: 0,
    due_dates: 0,
    wins: 0,
    mentions: 0,
    skipped_private: restricted.length,
    note: 'nothing new'
  });
  const { data: types } = await svc.from('request_types').select('key,label,department,description').eq('enabled', true);
  const typesTxt = (types || []).map((t)=>'- ' + t.key + ': ' + (t.label || t.key) + ' (actioned by ' + t.department + '). ' + (t.description || '')).join('\n');
  const { data: openReqs } = await svc.from('dept_requests').select('id,title,department,type_key').eq('done', false).limit(50);
  const openReqIds = new Set((openReqs || []).map((r)=>r.id));
  const openReqById = new Map((openReqs || []).map((r)=>[
      r.id,
      r
    ]));
  const openReqTxt = (openReqs || []).map((r)=>'id ' + r.id + ': ' + r.title + ' (' + r.department + ', ' + (r.type_key || 'other') + ')').join('\n');
  const { data: pend } = await svc.from('request_suggestions').select('title').eq('status', 'pending').limit(40);
  const tracked = (pend || []).map((r)=>r.title).filter(Boolean);
  const { data: openTasks } = await svc.from('dept_tasks').select('id,title,department,owner,due_date').is('banked_at', null).eq('done', false).limit(400);
  const tasksTxt = (openTasks || []).map((t)=>t.id + '. ' + t.title + ' (' + t.department + (t.owner ? ', owner ' + t.owner : '') + ')').join('\n');
  const validIds = new Set((openTasks || []).map((t)=>t.id));
  const noDue = (openTasks || []).filter((t)=>!t.due_date);
  const noDueTxt = noDue.map((t)=>t.id + '. ' + t.title + ' (' + t.department + (t.owner ? ', owner ' + t.owner : '') + ')').join('\n');
  const noDueIds = new Set(noDue.map((t)=>t.id));
  const { data: pendDue } = await svc.from('task_due_suggestions').select('task_id').eq('status', 'pending').limit(400);
  const hasPendDue = new Set((pendDue || []).map((x)=>x.task_id));
  const { data: goals } = await svc.from('goals').select('id,department,quarter,title,measure,status').not('status', 'in', '("closed","done","archived")').limit(60);
  const goalById = new Map((goals || []).map((g)=>[
      g.id,
      g
    ]));
  const goalsTxt = (goals || []).map((g)=>'id ' + g.id + ': ' + g.title + ' (' + g.department + ', ' + (g.quarter || '') + (g.measure ? ', measured by: ' + g.measure : '') + ')').join('\n');
  const { data: roster } = await svc.from('team_members').select('name,department').eq('active', true);
  const rosterByName = new Map((roster || []).map((m)=>[
      String(m.name || '').toLowerCase(),
      m
    ]));
  const rosterTxt = (roster || []).map((m)=>'- ' + m.name + ' (' + (m.department || '') + ')').join('\n');
  const todayIso = new Date().toISOString().slice(0, 10);
  let reqFound = 0, cmtFound = 0, dueFound = 0, winFound = 0, menFound = 0, scannedN = 0;
  for (const tx of todo){
    scannedN++;
    let n = 0;
    const isSlack = String(tx.added_by || '').indexOf('Slack pull') === 0;
    const isLead = tx.visibility === 'leadership' || /leadership/i.test(String(tx.department || ''));
    const meetHdr = 'MEETING: ' + (tx.title || 'Untitled') + ' (' + (tx.department || '') + ', ' + (tx.meeting_date || '') + ')' + (isLead ? '\nMEETING KIND: LEADERSHIP (leaders of every department present; spread requests across the departments that action them)' : '') + '\nMEETING DATE: ' + (tx.meeting_date || 'unknown') + '\n\nSUMMARY:\n' + String(tx.ai_summary || '').slice(0, 3000) + '\n\nTRANSCRIPT:\n' + String(tx.body || '').slice(0, 14000);
    try {
      const body = await callModel(key, REQ_SYSTEM, 'REQUEST TYPES:\n' + typesTxt + '\n\nOPEN REQUESTS (for kind "refine", use these numeric ids only):\n' + openReqTxt + '\n\nALREADY SUGGESTED (skip anything matching these):\n' + tracked.map((t)=>'- ' + t).join('\n') + '\n\n' + meetHdr, REQ_TOOL, 'suggest_requests');
      for (const o of toolItems(body, 'suggest_requests', 'suggestions').slice(0, isLead ? 8 : 3)){
        const conf = Number(o.confidence) || 0;
        const title = String(o.title || '').trim().slice(0, 200);
        if (!title || conf < 5) continue;
        const isRef = o.kind === 'refine' && openReqIds.has(Number(o.target_request_id));
        const target = isRef ? openReqById.get(Number(o.target_request_id)) : null;
        const dept = isRef ? target.department : String(o.department || '');
        if (DEPTS.indexOf(dept) < 0) continue;
        const { error } = await svc.from('request_suggestions').insert({
          transcript_id: tx.id,
          kind: isRef ? 'refine' : 'new',
          target_request_id: isRef ? Number(o.target_request_id) : null,
          type_key: String(o.type_key || 'other').slice(0, 60),
          department: dept,
          title,
          details: String(o.details || '').slice(0, 1500) || null,
          assignee: o.assignee ? String(o.assignee).slice(0, 80) : null,
          confidence: Math.min(10, Math.max(1, conf)),
          quote: String(o.quote || '').slice(0, 300) || null
        });
        if (!error) {
          n++;
          reqFound++;
          tracked.push(title);
        }
      }
    } catch (_) {}
    try {
      if (tasksTxt) {
        const body2 = await callModel(key, CMT_SYSTEM, 'OPEN TASKS (use these numeric ids only):\n' + tasksTxt + '\n\n' + meetHdr, CMT_TOOL, 'attach_task_comments');
        for (const o of toolItems(body2, 'attach_task_comments', 'comments').slice(0, 5)){
          const tid = Number(o.task_id);
          const conf = Number(o.confidence) || 0;
          const text = String(o.comment || '').trim().slice(0, 800);
          if (!validIds.has(tid) || conf < 6 || !text) continue;
          const { error } = await svc.from('task_comments').insert({
            task_id: tid,
            body: text,
            author: isSlack ? 'Slack AI' : 'Meeting AI',
            source: isSlack ? 'slack' : 'transcript',
            source_ref: String(tx.id),
            source_label: (tx.title || 'Meeting') + ' (' + (tx.meeting_date || '') + ')',
            quote: String(o.quote || '').slice(0, 300) || null
          });
          if (!error) cmtFound++;
        }
      }
    } catch (_) {}
    try {
      if (noDueTxt) {
        const body3 = await callModel(key, DUE_SYSTEM, 'TASKS WITHOUT DUE DATES (use these numeric ids only):\n' + noDueTxt + '\n\n' + meetHdr, DUE_TOOL, 'suggest_due_dates');
        for (const o of toolItems(body3, 'suggest_due_dates', 'suggestions').slice(0, 5)){
          const tid = Number(o.task_id);
          const conf = Number(o.confidence) || 0;
          const dd = String(o.due_date || '');
          if (!noDueIds.has(tid) || hasPendDue.has(tid) || conf < 6) continue;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dd) || dd < todayIso) continue;
          const { error } = await svc.from('task_due_suggestions').insert({
            task_id: tid,
            transcript_id: tx.id,
            due_date: dd,
            confidence: Math.min(10, Math.max(1, conf)),
            quote: String(o.quote || '').slice(0, 300) || null
          });
          if (!error) {
            dueFound++;
            hasPendDue.add(tid);
          }
        }
      }
    } catch (_) {}
    try {
      if (goalsTxt) {
        const body4 = await callModel(key, WIN_SYSTEM, 'QUARTERLY GOALS (use these numeric ids only):\n' + goalsTxt + '\n\n' + meetHdr, WIN_TOOL, 'record_goal_wins');
        for (const o of toolItems(body4, 'record_goal_wins', 'wins').slice(0, 4)){
          const gid = Number(o.goal_id);
          const conf = Number(o.confidence) || 0;
          const win = String(o.win || '').trim().slice(0, 500);
          const g = goalById.get(gid);
          if (!g || conf < 6 || !win) continue;
          const { error } = await svc.from('goal_wins').insert({
            goal_id: gid,
            department: g.department,
            transcript_id: tx.id,
            win,
            quote: String(o.quote || '').slice(0, 300) || null,
            meeting_date: tx.meeting_date || null,
            visibility: tx.visibility || null,
            allowed_people: null
          });
          if (!error) winFound++;
        }
      }
    } catch (_) {}
    try {
      if (rosterTxt && !isSlack) {
        const speakers = Array.isArray(tx.speakers) ? tx.speakers.join(', ') : '(unknown)';
        const body5 = await callModel(key, MEN_SYSTEM, 'ROSTER (use these exact names only):\n' + rosterTxt + '\n\nSPEAKERS (present in the meeting, never mention-worthy):\n' + speakers + '\nUPLOADER: ' + (tx.added_by || '') + '\n\n' + meetHdr, MEN_TOOL, 'record_mentions');
        for (const o of toolItems(body5, 'record_mentions', 'mentions').slice(0, 5)){
          const conf = Number(o.confidence) || 0;
          const m = rosterByName.get(String(o.person || '').toLowerCase());
          if (!m || conf < 6) continue;
          const first = String(m.name).split(/\s+/)[0].toLowerCase();
          const spoke = Array.isArray(tx.speakers) && tx.speakers.some((s)=>String(s || '').toLowerCase().indexOf(first) === 0);
          if (spoke) continue;
          const { error } = await svc.from('mentions').insert({
            person: m.name,
            transcript_id: tx.id,
            department: tx.department || null,
            meeting_title: tx.title || null,
            meeting_date: tx.meeting_date || null,
            context: String(o.context || '').slice(0, 500) || null,
            quote: String(o.quote || '').slice(0, 300) || null,
            visibility: tx.visibility || null
          });
          if (!error) menFound++;
        }
      }
    } catch (_) {}
    await svc.from('transcript_request_scans').upsert({
      transcript_id: tx.id,
      n_found: n,
      scanned_at: new Date().toISOString()
    });
  }
  return json({
    scanned: scannedN,
    requests: reqFound,
    comments: cmtFound,
    due_dates: dueFound,
    wins: winFound,
    mentions: menFound,
    skipped_private: restricted.length
  });
});
