// Routed through the Hub model router (llm, task 'draft') on 25/09/26: OpenRouter picks the model per ai_routes; the request and response shapes are unchanged.
// Welfare Avenue: draft-content (v5, 08/08/26)
// v5: the Welfare Avenue writing style (Steel's wa-writing guide, adapted
// org-wide) is appended to the SYSTEM from app_config 'wa_writing_style'
// on every call, so every Create-tab draft follows the house style and
// admins can edit the style text without a redeploy. Also: draft metadata
// gains style_version in notes-free form (no schema change).
// v4 adds content_type 'graphic'. v3 review routing. Voice: The Empathetic
// Mobilizer with per audience calibration. Grounding ALWAYS excludes
// board_only material. Never invents numbers: missing facts become
// [confirm: ...] placeholders. Auth: staff JWT or trigger secret.
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
async function cfg(key) {
  const { data } = await svc.from('app_config').select('value').eq('key', key).maybeSingle();
  return data?.value || '';
}
const TYPES = [
  'email',
  'social_post',
  'graphic',
  'report',
  'newsletter',
  'announcement',
  'letter',
  'other'
];
const AUDIENCES = [
  'beneficiaries',
  'volunteers',
  'partners',
  'sponsors_donors',
  'board',
  'staff',
  'general_public'
];
const TYPE_LABEL = {
  email: 'Email',
  social_post: 'Social post',
  graphic: 'Social graphic',
  report: 'Report',
  newsletter: 'Newsletter',
  announcement: 'Announcement',
  letter: 'Letter',
  other: 'Content'
};
const DRAFT_TOOL = {
  name: 'deliver_draft',
  description: 'Return the finished branded draft.',
  input_schema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Short internal title for this draft, e.g. "Sponsor pitch: Sunday kitchen expansion".'
      },
      subject_line: {
        type: 'string',
        description: 'Email subject line, or headline for a post, graphic or report. Empty string if not applicable.'
      },
      body_md: {
        type: 'string',
        description: 'The full draft in simple markdown: paragraphs separated by blank lines, ## for section headings in reports and newsletters, - for lists. Emails and social posts usually need no headings at all. For a social graphic: one to three short support lines, each on its own line, plain text.'
      },
      short_version: {
        type: 'string',
        description: 'A compact alternative: for social posts a shorter caption variant, for emails a two sentence version, for reports a one paragraph executive summary, for a social graphic the call to action. Empty string if truly not useful.'
      },
      notes: {
        type: 'string',
        description: 'Anything the writer must check before sending: [confirm: ...] placeholders used, facts assumed, suggested attachments. Empty string if nothing.'
      }
    },
    required: [
      'title',
      'subject_line',
      'body_md',
      'short_version',
      'notes'
    ]
  }
};
const MODELS = [
  'claude-fable-5',
  'claude-sonnet-5',
  'claude-sonnet-4-5',
  'claude-sonnet-4-20250514'
];
const SYSTEM_BASE = `You are the in house writer for Welfare Avenue, a youth led nonprofit in Montreal and Toronto that uses shared meals as the starting point for dignity, trust and social reintegration. You write in the organization's voice: The Empathetic Mobilizer, the bridge between the warmth of a community safety net and the precision of a professional organization. The voice is maturing: it keeps the innovative energy of a youth led movement while showing the reliability and discipline of a premier institution. Tagline, when one fits: "Service is solidarity, not charity."

The hook philosophy: Welfare Avenue does not just feed people. Food is the conduit; the meal builds trust, the goal is to restore dignity and facilitate social reintegration. Never describe the work as handing out food, never say "feed the homeless", never use pity language.

Audience calibration:
- beneficiaries: consistent, warm, non judgmental, reliable. Focus on the person, not the condition. Reinforce the safety net ("you can always fall back on us") and commitment ("see you next Sunday"). Never express uncertainty about whether services will run. Keywords: community, connection, safety net, dignity, support.
- volunteers: energetic, inclusive, youth powered, structured. Frame roles as growth and leadership opportunities in a movement, never as needing bodies. Reinforce structure (Slack, itineraries) and the collective "we". Keywords: movement, impact, skills, youth powered, team.
- partners: collaborative, professional, solution oriented. Welfare Avenue is a specialized conduit that complements existing services, builds initial trust through food, then refers to specialized agencies. Show data awareness and respect for long standing partners; never claim to do everything or to be the only ones doing it right. Keywords: conduit, ecosystem, bridge, collaboration, data driven.
- sponsors_donors: ambitious, professional, impact focused, maturing. Show ROI and scale ("a scalable model"), holistic reintegration rather than just meals, high visibility CSR opportunities, disciplined operations, "a youth led professional organization engaging future leaders". Never "student project", never "money to buy groceries", never sound improvised. Keywords: investment, scalable, impact, CSR, professional.
- board: credible, accountable, no surprises. Plain statements of fact and constraint, concrete names and figures, clear next steps.
- staff: direct, appreciative, first names, give credit publicly.
- general_public: warm, confident, mission led; solidarity not charity.

House style, all audiences:
- Open with a specific thank you or acknowledgment when the format allows it.
- Short paragraphs, often one sentence, with white space.
- State facts plainly without hedging or over apologising.
- Concrete names and figures where provided.
- Emails close with a low friction next step, then a sign off: "Warmly," or "Best regards," as fits. Use the sender name given in the brief, otherwise leave a [sender name] placeholder.
- Never use em dashes anywhere. Use a comma, colon, parentheses, or split the sentence.
- No charity boilerplate: never "in these challenging times", never "making a difference together".
- Do not over format: no heavy bolding, headings only in reports and newsletters.
- French drafts: formal French for donors and partners, French Canadian currency style (724.63$), sign off "Merci et bonne journée!" where an email sign off fits.

Facts discipline: use ONLY numbers and facts given in the brief or the grounding context. If a claim needs a number you do not have, write [confirm: what is needed] in the text and list it in notes. Never invent statistics, dates, names or amounts.`;
async function buildSystem() {
  let style = '';
  try {
    style = await cfg('wa_writing_style');
  } catch (_) {
    style = '';
  }
  if (!style) return SYSTEM_BASE;
  return SYSTEM_BASE + '\n\n' + style.slice(0, 6000) + '\n\nWhen the addendum above and the general guidance differ, the addendum wins: it is the organization\'s current house style.';
}
async function generate(userMsg) {
  const key = 'hub-router';
  if (!key) throw new Error('ANTHROPIC_API_KEY missing');
  const system = await buildSystem();
  let lastErr = '';
  for (const model of MODELS){
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'x-wa-task': 'draft',
        'x-wa-caller': 'draft-content',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 3000,
        temperature: 0.4,
        system,
        messages: [
          {
            role: 'user',
            content: userMsg.slice(0, 40000)
          }
        ],
        tools: [
          DRAFT_TOOL
        ],
        tool_choice: {
          type: 'tool',
          name: 'deliver_draft'
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
  throw new Error('draft call failed: ' + lastErr);
}
async function sendReview(draftId, who) {
  const { data: d } = await svc.from('content_drafts').select('*').eq('id', draftId).maybeSingle();
  if (!d) return json({
    error: 'draft not found'
  }, 404);
  const site = await cfg('site_url') || 'https://wa-exec-dashboard.netlify.app';
  const excerptFull = d.body_md || '';
  const excerpt = excerptFull.slice(0, 700);
  const text = ':memo: *Draft for review* from the dashboard Create studio\n' + '*' + (d.subject_line || d.title || 'Untitled') + '*\n' + (TYPE_LABEL[d.content_type] || 'Content') + ' for ' + String(d.audience || '').replace(/_/g, ' ') + (d.language === 'fr' ? ' (French)' : '') + ', drafted by ' + (d.created_by || who) + '\n\n' + excerpt + (excerptFull.length > 700 ? '\n...(trimmed, full draft on the dashboard)' : '') + '\n' + (d.notes ? '\n:warning: Check before sending: ' + d.notes + '\n' : '') + '\n<' + site + '#create|Open in the Create studio>';
  let posted = false, where = '';
  try {
    const rw = await getSecret('SLACK_REVIEW_WEBHOOK_URL');
    if (rw) {
      const r0 = await fetch(rw, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text
        })
      });
      if (r0.ok) {
        posted = true;
        where = await cfg('review_channel_name') || 'the review channel';
      }
    }
  } catch (_) {}
  if (!posted) {
    const channelId = await cfg('review_channel_id');
    if (channelId) {
      try {
        const tok = await getSecret('SLACK_BOT_TOKEN');
        if (tok) {
          const r = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + tok,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              channel: channelId,
              text,
              unfurl_links: false
            })
          });
          const rb = await r.json();
          if (rb.ok) {
            posted = true;
            where = await cfg('review_channel_name') || 'the review channel';
          }
        }
      } catch (_) {}
    }
  }
  if (!posted) {
    try {
      const url = await getSecret('SLACK_WEBHOOK_URL');
      if (url) {
        const r2 = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text
          })
        });
        if (r2.ok) {
          posted = true;
          where = '#exec-dashboard';
        }
      }
    } catch (_) {}
  }
  if (!posted) return json({
    error: 'Slack post failed on every channel'
  }, 500);
  await svc.from('content_drafts').update({
    status: 'in review',
    updated_at: new Date().toISOString()
  }).eq('id', draftId);
  return json({
    ok: true,
    channel: where
  });
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
  if (body.action === 'send_review') {
    return await sendReview(Number(body.draft_id) || 0, auth.who);
  }
  if (body.action === 'style') {
    return json({
      style: await cfg('wa_writing_style')
    });
  }
  const contentType = TYPES.indexOf(body.content_type) >= 0 ? body.content_type : 'email';
  const audience = AUDIENCES.indexOf(body.audience) >= 0 ? body.audience : 'partners';
  const language = body.language === 'fr' ? 'fr' : 'en';
  const dept = typeof body.department === 'string' && body.department ? String(body.department).toLowerCase() : null;
  const brief = String(body.brief || '').slice(0, 6000);
  const revision = String(body.revision || '').slice(0, 2000);
  const draftId = Number(body.draft_id) || null;
  if (!brief && !draftId) return json({
    error: 'brief required'
  }, 400);
  const parts = [];
  parts.push('CONTENT TYPE: ' + contentType + '\nAUDIENCE: ' + audience + '\nLANGUAGE: ' + (language === 'fr' ? 'French (formal, French Canadian conventions)' : 'English'));
  if (contentType === 'graphic') {
    parts.push('This is a SOCIAL GRAPHIC: the words will be placed onto a branded square tile, so every word must earn its place. subject_line = the headline, 8 words maximum, punchy, works in uppercase. body_md = one to three short support lines, each on its own line, 12 words maximum each, plain text only, no markdown, no hashtags, no sign off. short_version = the call to action, 6 words maximum, e.g. "Sign up, link in bio". No paragraphs anywhere.');
  }
  let prior = null;
  if (draftId) {
    const { data: pd } = await svc.from('content_drafts').select('brief, body_md, title').eq('id', draftId).maybeSingle();
    prior = pd || null;
  }
  if (prior && revision) {
    parts.push('THIS IS A REVISION. Original brief: ' + (prior.brief || '(none)') + '\n\nCurrent draft:\n' + (prior.body_md || '') + '\n\nRevision requested: ' + revision + '\n\nApply the revision while keeping everything that was not questioned.');
  } else {
    parts.push('BRIEF FROM THE WRITER:\n' + brief);
  }
  if (dept) {
    try {
      const { data: recent } = await svc.from('transcripts').select('title, meeting_date, ai_summary').eq('department', dept).eq('board_only', false).order('meeting_date', {
        ascending: false
      }).limit(3);
      if (recent && recent.length) {
        parts.push('RECENT ' + dept.toUpperCase() + ' MEETING SUMMARIES (context, use only what is relevant):\n' + recent.map((h)=>'- ' + (h.title || 'Untitled') + ' (' + (h.meeting_date || '') + '): ' + (h.ai_summary || '').slice(0, 500)).join('\n'));
      }
      const { data: tasks } = await svc.from('dept_tasks').select('title, owner').eq('department', dept).eq('done', false).eq('board_only', false).limit(12);
      if (tasks && tasks.length) {
        parts.push('OPEN ' + dept.toUpperCase() + ' TASKS:\n' + tasks.map((t)=>'- ' + t.title + ' (' + (t.owner || 'unowned') + ')').join('\n'));
      }
      const { data: goals } = await svc.from('goals').select('title, status, measure').eq('department', dept).limit(10);
      if (goals && goals.length) {
        parts.push('Q4 GOALS FOR ' + dept.toUpperCase() + ':\n' + goals.map((g)=>'- ' + g.title + (g.status ? ' [' + g.status + ']' : '') + (g.measure ? ' (' + g.measure + ')' : '')).join('\n'));
      }
    } catch (_) {}
  }
  try {
    const out = await generate(parts.join('\n\n'));
    const row = {
      created_by: auth.who,
      content_type: contentType,
      audience,
      language,
      department: dept,
      brief: prior && revision ? prior.brief || brief : brief,
      title: out.title || (prior?.title ?? 'Untitled draft'),
      subject_line: out.subject_line || null,
      body_md: out.body_md || '',
      short_version: out.short_version || null,
      notes: out.notes || null,
      status: 'draft'
    };
    const { data: saved, error } = await svc.from('content_drafts').insert(row).select('*').single();
    if (error) return json({
      error: 'save failed: ' + error.message
    }, 500);
    return json({
      ok: true,
      draft: saved
    });
  } catch (e) {
    return json({
      error: String(e)
    }, 500);
  }
});
