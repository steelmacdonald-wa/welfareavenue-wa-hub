// wave132 (26/09/26): leaves out what is in the bank (tasks and projects parked for three months or more carry banked_at until they come back).
// Routed through the Hub model router (llm, task 'draft') on 25/09/26: OpenRouter picks the model per ai_routes; the request and response shapes are unchanged.
// Welfare Avenue: build-agenda (v6, 03/08/26)
// v6: restricted meetings. Transcripts with visibility 'leadership' or
// 'private' are excluded from every agenda context (like board_only):
// their content must not leak into shared agenda notes.
// v5: meeting purpose and structure (body.purpose is the blueprint,
// stored on the agendas row).
// v4: board_only confidentiality tier on all context queries.
// v3 (23/07/26): agendas for any meeting (department, oneonone, group, leaders).
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
  opsmtl: 'Operations Montreal',
  progdev: 'Program Development',
  opsto: 'Operations Toronto',
  marketing: 'Marketing',
  fundraising: 'Fundraising and Finances',
  hr: 'Human Resources',
  board: 'Board'
};
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
      who: 'system'
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
      who: email.split('@')[0]
    };
  }
  return {
    ok: false,
    who: ''
  };
}
function areaKey(a) {
  const s = (a || '').toLowerCase();
  if (s.indexOf('mtl') >= 0 || s.indexOf('montreal') >= 0) return 'opsmtl';
  if (s === 'ops to' || s.indexOf('toronto') >= 0) return 'opsto';
  if (s.indexOf('fund') >= 0 || s.indexOf('grant') >= 0) return 'fundraising';
  if (s.indexOf('market') >= 0) return 'marketing';
  if (s === 'hr' || s.indexOf('human') >= 0) return 'hr';
  if (s.indexOf('board') >= 0) return 'board';
  return null;
}
const AGENDA_TOOL = {
  name: 'build_agenda',
  description: 'Return the drafted meeting agenda.',
  input_schema: {
    type: 'object',
    properties: {
      title: {
        type: 'string'
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            kind: {
              type: 'string',
              enum: [
                'project',
                'decision',
                'update',
                'topic'
              ]
            },
            title: {
              type: 'string'
            },
            notes: {
              type: 'string',
              description: '1 to 2 plain lines: why this matters now, citing the meeting or data it comes from.'
            },
            task_ids: {
              type: 'array',
              items: {
                type: 'integer'
              },
              description: 'ONLY ids from the provided open task list that belong under this item. Empty array if none.'
            }
          },
          required: [
            'kind',
            'title',
            'notes',
            'task_ids'
          ]
        }
      }
    },
    required: [
      'title',
      'items'
    ]
  }
};
const MODELS = [
  'claude-sonnet-5',
  'claude-sonnet-4-5',
  'claude-sonnet-4-20250514'
];
const BASE_RULES = ' Rules for every agenda: 4 to 8 items. Attach task_ids ONLY from the numbered open task list, and only where the task genuinely belongs under that item; never invent ids. Notes are 1 to 2 plain lines saying why this matters now, citing the source (for example: raised in the Jul 13 program development meeting). Never use em dashes anywhere; use commas, colons, or parentheses. Plain text only.';
const PURPOSE_RULE = ' The organizer has stated the MEETING PURPOSE AND STRUCTURE in the context. Treat it as the blueprint: mirror its structure and order in your items, pull in only the tasks and topics that serve that purpose, and drop anything that does not fit it, even if it would otherwise be a good agenda item.';
const PREFIX = 'You draft meeting agendas for Welfare Avenue, a youth homelessness charity in Montreal and Toronto run by co executive directors Steel and Suhaib. ';
const SYSTEMS = {
  department: PREFIX + 'Build a focused agenda for ONE department from the provided context. Group work by its project or workstream (use the subsection names as projects where present, kind project). Put urgent, flagged, or overdue work first. If open executive decisions exist for this department, include one item (kind decision) listing them in the notes. Use kind update for quick report-backs and kind topic for discussions.' + BASE_RULES,
  oneonone: PREFIX + 'Build the agenda for a 1 on 1 between the two named people. If one side is an executive director (Steel or Suhaib), focus on the other person: recent wins and appreciation first (kind update), then their open workload (kind project with their task_ids), blockers and support they need (kind topic), decisions involving them (kind decision), and a forward look or growth topic (kind topic). If they are peers, focus on the work they share, handoffs between them, and how they can unblock each other. Keep it human and supportive.' + BASE_RULES,
  group: PREFIX + 'Build the agenda for a meeting between the NAMED ATTENDEES only; everything must be relevant to the people in the room. Start with the work they share (kind project, attach task_ids), then handoffs and dependencies between them (kind topic), blockers where one needs another (kind topic), decisions this group can move (kind decision), and at most one short round of individual updates (kind update) if genuinely useful. Do not include department business that none of the attendees own.' + BASE_RULES,
  leaders: PREFIX + 'Build the leaders team meeting agenda, attended by the leaders of every department plus Steel and Suhaib. Open with org wide wins (kind update), then one tight per department update item ONLY where something needs the whole group (do not force all six), then cross team topics (kind topic) such as shared bottlenecks, staffing, upcoming events, then open executive decisions the group should weigh in on (kind decision). Prefer fewer, sharper items over full coverage.' + BASE_RULES
};
async function generate(scope, context, hasPurpose) {
  const key = 'hub-router';
  if (!key) throw new Error('ANTHROPIC_API_KEY missing');
  const system = (SYSTEMS[scope] || SYSTEMS.department) + (hasPurpose ? PURPOSE_RULE : '');
  let lastErr = '';
  for (const model of MODELS){
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'x-wa-task': 'draft',
        'x-wa-caller': 'build-agenda',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 2500,
        temperature: 0.2,
        system,
        messages: [
          {
            role: 'user',
            content: context.slice(0, 45000)
          }
        ],
        tools: [
          AGENDA_TOOL
        ],
        tool_choice: {
          type: 'tool',
          name: 'build_agenda'
        }
      })
    });
    if (res.ok) {
      const body = await res.json();
      const tu = (body.content || []).find((c)=>c.type === 'tool_use');
      if (tu?.input) return tu.input;
      lastErr = 'no tool_use returned';
      continue;
    }
    lastErr = res.status + ' ' + (await res.text()).slice(0, 200);
    if (res.status !== 404 && res.status !== 400) break;
  }
  throw new Error('agenda call failed: ' + lastErr);
}
function fmtTasks(tasks) {
  return tasks.map((t)=>t.id + '. [' + (t.department ? (DEPT_LABEL[t.department] || t.department) + (t.subsection ? ' / ' + t.subsection : '') : t.subsection || 'General') + '] ' + t.title + ' (owner ' + (t.owner || 'unassigned') + (t.flag ? ', FLAGGED' : '') + (t.due_date ? ', due ' + t.due_date : '') + ')').join('\n');
}
function matchMember(members, raw) {
  const p = raw.toLowerCase().trim();
  return members.find((m)=>m.name.toLowerCase() === p) || members.find((m)=>m.name.toLowerCase().indexOf(p) >= 0 || p.indexOf(m.name.toLowerCase()) >= 0) || members.find((m)=>p.length >= 4 && m.name.toLowerCase().slice(0, 4) === p.slice(0, 4)) || null;
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
  let scope = String(body.scope || 'department');
  let attendees = Array.isArray(body.attendees) ? body.attendees.map((x)=>String(x)).filter(Boolean).slice(0, 8) : [];
  if (scope === 'people') scope = attendees.length === 2 ? 'oneonone' : 'group';
  if ([
    'department',
    'oneonone',
    'leaders',
    'group'
  ].indexOf(scope) < 0) scope = 'department';
  const meetingDate = typeof body.meeting_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.meeting_date) ? body.meeting_date : new Date().toISOString().slice(0, 10);
  const purpose = String(body.purpose || '').trim().slice(0, 1200);
  const parts = [];
  const taskIds = new Set();
  let dept = null;
  let personLabel = null;
  let execImplied = false;
  // Agenda context always excludes board_only and restricted (leadership/private) rows.
  if (scope === 'department') {
    dept = String(body.department || '');
    if (!DEPT_LABEL[dept]) return json({
      error: 'valid department required'
    }, 400);
    parts.push('Draft the agenda for: ' + DEPT_LABEL[dept] + '. Meeting date: ' + meetingDate + '.');
    const { data: tx } = await svc.from('transcripts').select('title, meeting_date, ai_summary').eq('department', dept).eq('board_only', false).or(OPEN_VIS).order('meeting_date', {
      ascending: false
    }).limit(5);
    if (tx && tx.length) parts.push('RECENT MEETINGS:\n' + tx.map((t)=>'- ' + (t.title || 'Untitled') + ' (' + (t.meeting_date || '') + '): ' + (t.ai_summary || '').slice(0, 700)).join('\n'));
    const { data: tasks } = await svc.from('dept_tasks').select('id, title, owner, subsection, flag, due_date').is('banked_at', null).eq('department', dept).eq('done', false).eq('board_only', false).or(OPEN_VIS).order('subsection').limit(40);
    (tasks || []).forEach((t)=>taskIds.add(t.id));
    if (tasks && tasks.length) parts.push('OPEN TASKS (use these ids):\n' + fmtTasks(tasks));
    const { data: decs } = await svc.from('decisions').select('title, area, owner').eq('done', false).eq('board_only', false).or(OPEN_VIS);
    const dd = (decs || []).filter((d)=>areaKey(d.area) === dept);
    if (dd.length) parts.push('OPEN EXECUTIVE DECISIONS FOR THIS DEPARTMENT:\n' + dd.map((d)=>'- ' + d.title + ' (owner ' + (d.owner || 'Steel and Suhaib') + ')').join('\n'));
    const { data: meta } = await svc.from('dept_meta').select('progress, priorities').eq('department', dept).maybeSingle();
    if (meta && (meta.progress || (meta.priorities || []).length)) parts.push('DEPARTMENT STATE: ' + (meta.progress || '') + ' Priorities: ' + JSON.stringify(meta.priorities || []));
    const { count: reqN } = await svc.from('dept_requests').select('id', {
      count: 'exact',
      head: true
    }).eq('department', dept).eq('done', false);
    if (reqN) parts.push('OPEN INCOMING REQUESTS: ' + reqN + ' awaiting this department on the dashboard.');
  }
  if (scope === 'oneonone' || scope === 'group') {
    if (!attendees.length && body.person) {
      attendees = [
        String(body.person)
      ];
      execImplied = true;
    }
    if (!attendees.length) return json({
      error: 'attendees required'
    }, 400);
    const { data: roster } = await svc.from('team_members').select('name, department, role').eq('active', true);
    const members = [];
    const missing = [];
    for (const a of attendees){
      const m = matchMember(roster || [], a);
      if (m && !members.find((x)=>x.name === m.name)) members.push(m);
      else if (!m) missing.push(a);
    }
    if (missing.length) return json({
      error: 'not found in the active roster: ' + missing.join(', ')
    }, 400);
    if (scope === 'oneonone' && members.length === 1) execImplied = true;
    personLabel = members.map((m)=>m.name).join(', ');
    attendees = members.map((m)=>m.name);
    const depts = Array.from(new Set(members.map((m)=>m.department).filter(Boolean)));
    dept = depts.length === 1 ? depts[0] : null;
    parts.push('Draft the agenda for a ' + (scope === 'oneonone' ? '1 on 1' : 'meeting') + ' between: ' + members.map((m)=>m.name + ' (' + (m.role || 'team member') + ', ' + (DEPT_LABEL[m.department] || m.department) + ')').join('; ') + (execImplied ? '. The other side of this 1 on 1 is the executive directors Steel and Suhaib.' : '') + ' Meeting date: ' + meetingDate + '.');
    const firsts = members.map((m)=>m.name.split(' ')[0]);
    const { data: tasks } = await svc.from('dept_tasks').select('id, title, owner, subsection, flag, due_date, department').is('banked_at', null).eq('done', false).eq('board_only', false).or(OPEN_VIS).or(firsts.map((f)=>'owner.ilike.%' + f + '%').join(',')).limit(40);
    (tasks || []).forEach((t)=>taskIds.add(t.id));
    if (tasks && tasks.length) parts.push('OPEN TASKS OWNED BY THE ATTENDEES (use these ids):\n' + fmtTasks(tasks));
    for (const d of depts.slice(0, 4)){
      const { data: tx } = await svc.from('transcripts').select('title, meeting_date, ai_summary').eq('department', d).eq('board_only', false).or(OPEN_VIS).order('meeting_date', {
        ascending: false
      }).limit(2);
      if (tx && tx.length) parts.push('RECENT ' + (DEPT_LABEL[d] || d).toUpperCase() + ' MEETINGS:\n' + tx.map((t)=>'- ' + (t.title || 'Untitled') + ' (' + (t.meeting_date || '') + '): ' + (t.ai_summary || '').slice(0, 500)).join('\n'));
    }
    try {
      const { data: hits } = await svc.from('transcripts').select('title, meeting_date, ai_summary').eq('board_only', false).or(OPEN_VIS).textSearch('fts', firsts.join(' OR '), {
        type: 'websearch'
      }).order('meeting_date', {
        ascending: false
      }).limit(4);
      if (hits && hits.length) parts.push('MEETINGS MENTIONING THE ATTENDEES:\n' + hits.map((h)=>'- ' + (h.title || 'Untitled') + ' (' + (h.meeting_date || '') + '): ' + (h.ai_summary || '').slice(0, 450)).join('\n'));
    } catch (_) {}
    const { data: decs } = await svc.from('decisions').select('title, area, owner').eq('done', false).eq('board_only', false).or(OPEN_VIS);
    const dd = (decs || []).filter((d)=>firsts.some((f)=>((d.owner || '') + ' ' + (d.title || '')).toLowerCase().indexOf(f.toLowerCase()) >= 0) || depts.indexOf(areaKey(d.area) || '') >= 0);
    if (dd.length) parts.push('OPEN DECISIONS TOUCHING THE ATTENDEES OR THEIR DEPARTMENTS:\n' + dd.map((d)=>'- ' + d.title).join('\n'));
    const { data: hrs } = await svc.from('slack_hours').select('member_name, week_start, hours, sessions').in('member_name', attendees).order('week_start', {
      ascending: false
    }).limit(attendees.length * 2);
    if (hrs && hrs.length) parts.push('RECENT TRACKED HOURS: ' + hrs.map((h)=>h.member_name + ' ' + h.week_start + ': ' + h.hours + 'h/' + h.sessions + ' sessions').join(', '));
    const { data: metas } = await svc.from('dept_meta').select('department, progress, priorities').in('department', depts);
    if (metas && metas.length) parts.push('DEPARTMENT STATES:\n' + metas.map((x)=>'- ' + (DEPT_LABEL[x.department] || x.department) + ': ' + (x.progress || '').slice(0, 180)).join('\n'));
  }
  if (scope === 'leaders') {
    parts.push('Draft the leaders team meeting agenda. Meeting date: ' + meetingDate + '. Attendees: department leaders plus Steel and Suhaib.');
    const { data: metas } = await svc.from('dept_meta').select('department, progress, priorities');
    if (metas && metas.length) parts.push('DEPARTMENT STATES:\n' + metas.map((x)=>'- ' + (DEPT_LABEL[x.department] || x.department) + ': ' + (x.progress || '').slice(0, 200) + ' Priorities: ' + JSON.stringify(x.priorities || [])).join('\n'));
    const { data: flagged } = await svc.from('dept_tasks').select('id, title, owner, subsection, flag, due_date, department').is('banked_at', null).eq('done', false).eq('flag', true).eq('board_only', false).or(OPEN_VIS).limit(20);
    (flagged || []).forEach((t)=>taskIds.add(t.id));
    if (flagged && flagged.length) parts.push('FLAGGED TASKS ACROSS DEPARTMENTS (use these ids):\n' + fmtTasks(flagged));
    const { data: decs } = await svc.from('decisions').select('title, area').eq('done', false).eq('board_only', false).or(OPEN_VIS);
    if (decs && decs.length) parts.push('ALL OPEN EXECUTIVE DECISIONS:\n' + decs.map((d)=>'- [' + (d.area || '') + '] ' + d.title).join('\n'));
    const { data: tx } = await svc.from('transcripts').select('title, meeting_date, department, ai_summary').eq('board_only', false).or(OPEN_VIS).order('meeting_date', {
      ascending: false
    }).limit(6);
    if (tx && tx.length) parts.push('LATEST MEETINGS ACROSS THE ORG:\n' + tx.map((t)=>'- ' + (t.title || 'Untitled') + ' (' + (t.meeting_date || '') + ', ' + (t.department || '') + '): ' + (t.ai_summary || '').slice(0, 400)).join('\n'));
  }
  if (purpose) parts.splice(1, 0, 'MEETING PURPOSE AND STRUCTURE (from the organizer; this is the blueprint for the agenda):\n' + purpose);
  try {
    const out = await generate(scope, parts.join('\n\n'), !!purpose);
    const fallbackTitle = scope === 'oneonone' ? '1on1: ' + personLabel + ' (' + meetingDate + ')' : scope === 'group' ? 'Meeting: ' + personLabel + ' (' + meetingDate + ')' : scope === 'leaders' ? 'Leaders meeting agenda: ' + meetingDate : (DEPT_LABEL[dept || ''] || '') + ' meeting agenda';
    const { data: ag, error: agErr } = await svc.from('agendas').insert({
      department: dept,
      scope: scope,
      with_person: personLabel,
      attendees: attendees,
      title: (out.title || fallbackTitle).slice(0, 200),
      meeting_date: meetingDate,
      status: 'draft',
      created_by: 'AI (' + auth.who + ')',
      purpose: purpose || null
    }).select('id').single();
    if (agErr || !ag) throw new Error('agenda insert failed: ' + (agErr?.message || ''));
    let sort = 0, inserted = 0;
    for (const it of (out.items || []).slice(0, 10)){
      const ids = (it.task_ids || []).filter((id)=>taskIds.has(Number(id))).map(Number);
      const { error } = await svc.from('agenda_items').insert({
        agenda_id: ag.id,
        kind: [
          'project',
          'decision',
          'update',
          'topic'
        ].indexOf(it.kind) >= 0 ? it.kind : 'topic',
        title: (it.title || 'Item').slice(0, 300),
        notes: (it.notes || '').slice(0, 1000),
        sort: sort++,
        task_ids: ids
      });
      if (!error) inserted++;
    }
    await svc.from('change_log').insert({
      entity_type: 'agenda',
      entity_id: String(ag.id),
      field: 'generated',
      old_value: null,
      new_value: scope + (personLabel ? ' with ' + personLabel : '') + (dept ? ' (' + dept + ')' : '') + ': ' + inserted + ' items for ' + meetingDate,
      changed_by: 'AI agenda (' + auth.who + ')'
    });
    return json({
      ok: true,
      agenda_id: ag.id,
      title: out.title,
      items: inserted
    });
  } catch (e) {
    return json({
      error: String(e)
    }, 500);
  }
});
