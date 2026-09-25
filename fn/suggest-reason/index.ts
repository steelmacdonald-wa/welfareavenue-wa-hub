// Routed through the Hub model router (llm, task 'reason') on 25/09/26: OpenRouter picks the model per ai_routes; the request and response shapes are unchanged.
// Welfare Avenue: suggest-reason
// Generates the reason category and one line rationale for an executive
// decision or flagged task, so humans do not have to write them by hand.
// Auth: staff JWT.
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
    if ((data?.user?.email || '').toLowerCase().endsWith('@welfareavenue.com')) return true;
  }
  return false;
}
const TOOL = {
  name: 'set_reason',
  description: 'Set the reason category and rationale.',
  input_schema: {
    type: 'object',
    properties: {
      reason_category: {
        type: 'string',
        enum: [
          'Budget or purchase',
          'Hiring or people',
          'Legal, risk, or governance',
          'Strategy or direction',
          'Partnership or external',
          'Ethics or policy'
        ]
      },
      reason_note: {
        type: 'string',
        description: 'One line, under 20 words, stating why this needs an executive. No em dashes.'
      }
    },
    required: [
      'reason_category',
      'reason_note'
    ]
  }
};
const MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-5',
  'claude-sonnet-4-5'
];
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: CORS
  });
  if (!await authorize(req)) return json({
    error: 'unauthorized'
  }, 401);
  const body = await req.json().catch(()=>({}));
  const title = String(body.title || '').slice(0, 300);
  if (!title) return json({
    error: 'title required'
  }, 400);
  const kind = body.kind === 'task' ? 'flagged task' : 'executive decision';
  const key = 'hub-router';
  if (!key) return json({
    error: 'tokens_missing'
  });
  const prompt = 'Welfare Avenue is a charity run by co executive directors Steel and Suhaib. Classify why this ' + kind + ' needs an executive and write a one line rationale. Never use em dashes.\n\nItem: ' + title + (body.area ? '\nArea: ' + String(body.area).slice(0, 60) : '') + (body.move ? '\nSuggested move: ' + String(body.move).slice(0, 300) : '');
  let lastErr = '';
  for (const model of MODELS){
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'x-wa-task': 'reason',
        'x-wa-caller': 'suggest-reason',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        tools: [
          TOOL
        ],
        tool_choice: {
          type: 'tool',
          name: 'set_reason'
        }
      })
    });
    if (res.ok) {
      const b = await res.json();
      const tu = (b.content || []).find((c)=>c.type === 'tool_use');
      if (tu?.input?.reason_category) return json({
        reason_category: tu.input.reason_category,
        reason_note: String(tu.input.reason_note || '').replace(/—/g, ',').slice(0, 200)
      });
      lastErr = 'no tool_use';
      continue;
    }
    lastErr = res.status + '';
    if (res.status !== 404 && res.status !== 400) break;
  }
  return json({
    error: 'generation failed: ' + lastErr
  }, 500);
});
