// wave132 (26/09/26): leaves out what is in the bank (tasks and projects parked for three months or more carry banked_at until they come back).
// v3 (25/09/26): routed through the Hub model router (llm, task decision; Jev picks the model) and Jev scores the recommended approach against the alternatives (jevScore).
// Welfare Avenue: recommend-decision (v2, 25/07/26)
// v2: board_only confidentiality tier. The target decision's board_only flag
// gates the context: when the decision is NOT board_only, every context query
// (transcript FTS, recent department transcripts, open department tasks) adds
// .eq('board_only', false) so board only material never leaks into a staff
// visible recommendation. When the decision IS board_only, no filters apply.
// The change_log entry this function writes carries the decision's board_only
// value.
// v1 (22/07/26): generates an approach recommendation for one executive
// decision, grounded in the transcript archive (FTS), recent department
// digests, open tasks and department meta. Saves to decisions.recommendation.
// Auth: staff JWT or internal trigger secret.
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
  if (s.indexOf(' to') >= 0 || s.indexOf('toronto') >= 0 || s === 'ops to') return 'opsto';
  if (s.indexOf('fund') >= 0 || s.indexOf('grant') >= 0) return 'fundraising';
  if (s.indexOf('market') >= 0) return 'marketing';
  if (s === 'hr' || s.indexOf('human') >= 0) return 'hr';
  if (s.indexOf('board') >= 0) return 'board';
  return null;
}
function keywords(title) {
  return (title || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w)=>w.length > 3 && [
      'with',
      'from',
      'that',
      'this',
      'have',
      'need',
      'sets',
      'each',
      'takes',
      'only'
    ].indexOf(w) < 0).slice(0, 6).join(' ');
}
const REC_TOOL = {
  name: 'give_recommendation',
  description: 'Return the recommendation for this executive decision.',
  input_schema: {
    type: 'object',
    properties: {
      recommendation: {
        type: 'string',
        description: 'The recommended approach, under 130 words, plain text, direct, references the evidence.'
      },
      options_considered: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: '2 to 3 short alternatives that were weighed.'
      },
      based_on: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'Short source references, e.g. "Ops MTL meeting Jul 13".'
      }
    },
    required: [
      'recommendation',
      'options_considered',
      'based_on'
    ]
  }
};
const MODELS = [
  'claude-sonnet-5',
  'claude-sonnet-4-5',
  'claude-sonnet-4-20250514'
];
const SYSTEM = `You advise the two co executive directors of Welfare Avenue, Steel and Suhaib, on one open executive decision. Ground every claim in the provided context (meeting summaries, open tasks, department state). Be direct and practical: recommend one approach, name the tradeoff, state the first concrete step and who takes it. If the context is thin, say so and recommend how to close the information gap instead of inventing facts. Never use em dashes anywhere; use commas, colons, or parentheses. Plain text only.`;
async function generate(context) {
  const key = 'hub-router';
  if (!key) throw new Error('ANTHROPIC_API_KEY missing');
  let lastErr = '';
  for (const model of MODELS){
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'x-wa-task': 'decision',
        'x-wa-caller': 'recommend-decision',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        temperature: 0.2,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: context.slice(0, 40000)
          }
        ],
        tools: [
          REC_TOOL
        ],
        tool_choice: {
          type: 'tool',
          name: 'give_recommendation'
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
  throw new Error('recommendation call failed: ' + lastErr);
}
/* ---- Jev scores the options (25/09/26) ----
   OpenRouter's decision model reads the same evidence and gives its odds
   for the recommended approach against the alternatives the model weighed.
   One line under the recommendation; never blocks it. */
async function jevScore(context, out) {
  try {
    const alts = Array.isArray(out.options_considered) ? out.options_considered.map((x)=>String(x)).filter(Boolean).slice(0, 3) : [];
    if (!alts.length) return '';
    const criteria = { rec: 'Recommended: ' + String(out.recommendation || '').slice(0, 400) };
    alts.forEach((a, i)=>{ criteria['alt' + i] = 'Alternative: ' + a.slice(0, 300); });
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + SERVICE_KEY, 'x-wa-task': 'decision', 'x-wa-caller': 'recommend-decision', 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: { evidence: String(context || '').slice(0, 14000), guidance: 'Welfare Avenue is a small charity in Montreal and Toronto run by two co executive directors. Judge by impact on the people served, money and staff time at risk, and what the evidence actually supports.' },
        questions: { best: { type: 'choice', instructions: 'Given the evidence, which option is the best call for the charity?', criteria } } })
    });
    if (!res.ok) return '';
    const body = await res.json();
    const a = body && body.answers ? body.answers.best : null;
    if (!a || !a.probabilities) return '';
    const p = a.probabilities;
    const pct = (k)=>Math.round(Number(p[k] || 0) * 100);
    const short = (t)=>{ t = String(t).replace(/[.:;,]+$/, ''); if (t.length <= 56) return t; const cut = t.slice(0, 56); return cut.slice(0, cut.lastIndexOf(' ') > 30 ? cut.lastIndexOf(' ') : 56) + '\u2026'; };
    const bits = ['the recommended approach ' + pct('rec') + '%'].concat(alts.map((alt, i)=>'\u201c' + short(alt) + '\u201d ' + pct('alt' + i) + '%'));
    let line = 'Jev’s odds: ' + bits.join(', ') + '.';
    if (a.choice && a.choice !== 'rec' && Number(p[a.choice] || 0) >= 0.55) line += ' Jev leans to the alternative; worth a second look.';
    return line;
  } catch (_) { return ''; }
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
  const id = Number(body.decision_id);
  if (!id) return json({
    error: 'decision_id required'
  }, 400);
  const { data: dec } = await svc.from('decisions').select('*').eq('id', id).maybeSingle();
  if (!dec) return json({
    error: 'decision not found'
  }, 404);
  const dept = areaKey(dec.area);
  // v2: a non board_only decision must never pull board_only context, because
  // the service role key bypasses RLS and the recommendation is staff visible.
  const boardOnly = dec.board_only === true;
  const parts = [];
  parts.push('DECISION TO ADVISE ON:\nTitle: ' + dec.title + '\nArea: ' + (dec.area || 'unknown') + '\nOwner: ' + (dec.owner || 'Steel and Suhaib') + '\nCategory: ' + (dec.reason_category || '') + '\nRationale on file: ' + (dec.reason_note || 'none') + '\nSuggested move on file: ' + (dec.suggested_move || 'none') + '\nRaised by: ' + (dec.raised_by || 'unknown'));
  try {
    const kw = keywords(dec.title);
    if (kw) {
      let hitsQ = svc.from('transcripts').select('title, meeting_date, department, ai_summary').textSearch('fts', kw, {
        type: 'websearch'
      });
      if (!boardOnly) hitsQ = hitsQ.eq('board_only', false);
      const { data: hits } = await hitsQ.order('meeting_date', {
        ascending: false
      }).limit(5);
      if (hits && hits.length) {
        parts.push('RELATED MEETINGS (keyword matched):\n' + hits.map((h)=>'- ' + (h.title || 'Untitled') + ' (' + (h.meeting_date || '') + ', ' + (h.department || '') + '): ' + (h.ai_summary || '').slice(0, 600)).join('\n'));
      }
    }
  } catch (_) {}
  if (dept) {
    let recentQ = svc.from('transcripts').select('title, meeting_date, ai_summary').eq('department', dept);
    if (!boardOnly) recentQ = recentQ.eq('board_only', false);
    const { data: recent } = await recentQ.order('meeting_date', {
      ascending: false
    }).limit(4);
    if (recent && recent.length) {
      parts.push('RECENT ' + dept.toUpperCase() + ' MEETINGS:\n' + recent.map((h)=>'- ' + (h.title || 'Untitled') + ' (' + (h.meeting_date || '') + '): ' + (h.ai_summary || '').slice(0, 500)).join('\n'));
    }
    let tasksQ = svc.from('dept_tasks').select('title, owner, status, subsection').is('banked_at', null).eq('department', dept).eq('done', false);
    if (!boardOnly) tasksQ = tasksQ.eq('board_only', false);
    const { data: tasks } = await tasksQ.limit(15);
    if (tasks && tasks.length) {
      parts.push('OPEN ' + dept.toUpperCase() + ' TASKS:\n' + tasks.map((t)=>'- ' + t.title + ' (' + (t.owner || 'unowned') + (t.subsection ? ', ' + t.subsection : '') + ')').join('\n'));
    }
    const { data: meta } = await svc.from('dept_meta').select('progress, priorities').eq('department', dept).maybeSingle();
    if (meta && (meta.progress || (meta.priorities || []).length)) {
      parts.push('DEPARTMENT STATE: ' + (meta.progress || '') + ' Priorities: ' + JSON.stringify(meta.priorities || []));
    }
  }
  try {
    const out = await generate(parts.join('\n\n'));
    const jevLine = await jevScore(parts.join('\n\n'), out);
    const recText = out.recommendation + (out.options_considered && out.options_considered.length ? '\n\nAlso considered: ' + out.options_considered.join(' | ') : '') + (jevLine ? '\n' + jevLine : '') + (out.based_on && out.based_on.length ? '\nBased on: ' + out.based_on.join('; ') : '');
    await svc.from('decisions').update({
      recommendation: recText,
      recommendation_at: new Date().toISOString()
    }).eq('id', id);
    await svc.from('change_log').insert({
      entity_type: 'decision',
      entity_id: String(id),
      field: 'recommendation',
      old_value: dec.recommendation ? 'refreshed' : null,
      new_value: recText.slice(0, 500),
      changed_by: 'AI recommendation (' + auth.who + ')',
      board_only: boardOnly
    });
    return json({
      ok: true,
      recommendation: recText
    });
  } catch (e) {
    return json({
      error: String(e)
    }, 500);
  }
});
