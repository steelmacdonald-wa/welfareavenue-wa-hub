// v15c (09/10/26): the answer check keeps what is fine (a line or a sentence at a time) instead of replacing a whole answer
// over one sentence, and takes out internal ids.
// v15b (09/10/26): the scrub works a clause at a time (a summary line that lists several things keeps the fine ones); answers
// lead with a plain sentence, bold only a short phrase, show no internal ids, at most five bullets.
// v15 (09/10/26, wave226): confidential by design, and in the WA voice. Steel: confidential information, "especially board
// meetings and my departure", must never be found in Ask the Hub, by anyone, him included; tasks from confidential meetings
// still exist but stay high level. His choices: no exceptions (everyone, Steel, Suhaib and the board included); off-limits are
// leadership changes (anyone's ED, co-ED, chair or president role, succession), board meetings and board documents, HR people
// matters (someone leaving or let go, performance, discipline, pay, health, time off details), and one-on-ones and
// leaders-only meetings. Four layers: (1) a question about an off-limits topic gets the same friendly answer every time,
// before any data is read or any model is called, so the answer never confirms or denies anything; (2) the context never
// holds a restricted meeting (one-on-one, leaders, confidential, board only, the Board team), a board-only, confidential or
// restricted task or decision, a time-off request, a leadership story row or document, or a board / HR / governance Drive
// file, whoever asks; (3) every sentence left in the context that touches an off-limits topic is dropped (CONF patterns);
// (4) the answer is checked again before it leaves, and the chat history sent back is filtered the same way.
// The voice: Steel's wa-writing skill (concise, warm, first names, no em dashes), light Markdown the Hub renders (bold, bullets,
// [label](link) links, never a bare address) and at most two of WA's own Slack emojis (:wa-heart-gold: and friends), which
// wave226's page draws from the brand kit.
// v14 (29/09/26, wave165): the meetings as the asker may read them. Steel: "1on1s should be confidential and not searchable by
// anyone except for those that are speaking in the meeting", and the older Loom meetings pulled in to "enhance the Ask the Hub".
// MEETINGS MATCHING THE QUESTION comes from wa_ask_meetings, run as the asker: any of the question's words, ranked by relevance
// (it used to need every word and took the newest), with each meeting's summary and the passage that matches, from every meeting
// the asker may read (a one-on-one only for the people who spoke in it; leadership and confidential meetings for their people),
// the archive-only ones included. Restricted meetings are marked, and the model keeps their details out of anything others read.
// A call without a person (the trigger secret) keeps the open meetings only. Program Development no longer counts twice.
// wave164 (29/09/26): Finance is its own team, apart from Fundraising: requests and tasks can go to finance (reimbursements, purchase
// approvals, invoices and receipts), and Fundraising is called Fundraising.
// v13 (26/09/26): our story (wave140, the Drive mining). An OUR STORY block from wa_story_context: the moments, year lines,
// partners, lessons learned and documents that match the question (accents and word endings forgiven), or the year it names;
// the asker's access decides what it holds (leaders and directors: leadership moments and sources; leaders only: leadership
// documents). Organization knowledge is picked by relevance, a section at a time, and always opens with the key facts.
// v12 (26/09/26): the bank. bank_task proposes moving an open task to the bank (out of every board until a date three months or more
// away); it runs as the signed-in person through the bank_task database function, so the Hub's own checks apply. Open task
// lists leave banked work out, and an IN THE BANK block lets it answer what is parked and when it comes back.
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
/* ---------- wave226: what Ask the Hub never talks about, for anyone ---------- */
const WHO_TOP = String.raw`(?:steel|suhaib|founder|co-?eds?|executive directors?|\beds?\b|chair(?:person|man|woman)?|vice[- ]?(?:chair|president)|president|ceo|leadership team|leaders?hip roles?)`;
const MOVE = String.raw`(?:leav\w*|left (?:the|welfare|wa\b|us\b|his|her|their|for)|quit\w*|depart\w*|step(?:s|ping|ped)?\s+(?:back|down|away|aside|out)|transition\w*|succe(?:ssion|ssor|ed)\w*|replac\w*|resign\w*|exit\w*|moving on|move on|hand(?:ing)?[- ]?(?:over|off)\w*|retir\w*|going away|role change|new role|takes? over|taking over|handing the reins)`;
const CONF = [
  /* leadership changes: Steel, Suhaib, an ED, the chair or the president leaving, stepping back, being replaced */
  new RegExp(WHO_TOP + String.raw`[^.?!\n]{0,70}\b` + MOVE, 'i'),
  new RegExp(String.raw`\b` + MOVE + String.raw`[^.?!\n]{0,45}` + WHO_TOP, 'i'),
  /\bsuccess(?:ion|or)s?\b/i,
  /\bleadership (?:changes?|transitions?|shake-?ups?|restructur\w*)\b/i,
  new RegExp(String.raw`\b(?:steel|suhaib)\b[^.?!\n]{0,40}\b(?:be|become|becomes|becoming|named|made|appointed|elected|moving to|move to)\b[^.?!\n]{0,20}\b(?:chair\w*|president|ceo|ed|co-?ed|executive director)\b`, 'i'),
  /\b(?:new|next|incoming|interim|future|replacement)\s+(?:co-?ed|ed|executive director|chair\w*|president|ceo|leader of the org\w*)\b/i,
  /\b(?:steel|suhaib)(?:'s|s)?\s+(?:role|future|plans?|position)\b/i,
  /\bwho(?:'s| is| will)?\s+(?:run|lead|take over)\w*\s+(?:welfare avenue|wa|the org\w*|the charity)\b/i,
  /* board matters */
  /\bboard(?:'s)?\s+(?:decid\w*|approv\w*|vot\w*|discuss\w*|said|say\w*|think\w*|want\w*|meetings?|minutes|packs?|decks?|votes?|voted|resolutions?|session|discussion|agenda|retreat|elections?|governance|chair|president|seats?|nominations?|of directors|decided|approved|in[- ]camera)\b/i,
  /\b(?:in[- ]camera|bylaws?|by-laws?|\bagm\b|annual general meeting|governance committee|executive committee)\b/i,
  /* HR people matters */
  /\b(?:fired|firing|let go|laid off|layoffs?|terminat\w*|dismiss\w*|disciplin\w*|warning letter|written warning|probation\w*|underperform\w*|\bpips?\b|performance (?:issues?|reviews?|improvement|concerns?|problems?|plan)|grievance\w*|harass\w*|misconduct|complaints? (?:about|against))\b/i,
  /\b(?:salar(?:y|ies)|wages?|pay (?:rate|raise|cut|band)s?|compensation|payroll|stipend amounts?|how much (?:is|does) \w+ (?:paid|make|earn))\b/i,
  /\b(?:resign\w*|quit(?:s|ting)?|stepp(?:ing|ed) down|step(?:s)? down|stepping back|leaving (?:the team|us|wa|welfare avenue|the org\w*|the charity|her role|his role|their role|the role)|last day|notice period|exit interview|offboard\w*)\b/i,
  /\b(?:(?:on|taking|took|takes|goes on|going on) (?:a )?(?:leave|medical leave|sick leave)|leave of absence)\b/i,
  /\b(?:medical (?:leave|reasons?|condition|issues?|appointments?)|sick leave|health (?:issue|condition|reasons?)|mental health|burn-?out|personal (?:reasons|commitments|issues|matters|situation|circumstances)|family (?:emergency|reasons|matters)|bereavement|maternity|paternity)\b/i,
  /\bconfidential\b/i
];
const CONF_ANSWER = "That one's not something I can share here :wa-heart-purple:\n\nSome conversations stay with the people they belong to: leadership changes, board matters and anyone's personal or HR situation. If it's something you need, the right person will bring it to you directly.\n\nAnything else I can dig up for you?";
function confHit(s) { const t = String(s || ''); for (const re of CONF) { if (re.test(t)) return true; } return false; }
/* drop what touches an off-limits topic, a clause at a time, and keep the rest as written: a sentence that lists several
   things ("Rami stepping down confirmed, Loyola Day tabling secured, ...") keeps the parts that are fine */
function confScrub(s) {
  const t = String(s || '');
  if (!t || !confHit(t)) return t;
  return t.split(/(?<=[.!?])\s+|\n+/).map((x)=>{
    if (!x || !confHit(x)) return x;
    const parts = x.split(/[,;]\s+/).filter((c)=>c && !confHit(c));
    return parts.length ? parts.join(', ').replace(/[,;:.!?\s]+$/, '') + '.' : '';
  }).filter(Boolean).join(' ').replace(/\s{2,}/g, ' ').trim();
}
/* a meeting Ask the Hub never reads, whoever asks: one-on-ones, leaders only, confidential, board only, the Board team */
function confMeeting(m) {
  const v = String(m.visibility || '').toLowerCase();
  if (v && v !== 'department') return true;
  if (m.board_only === true) return true;
  const d = String(m.department || '').toLowerCase();
  return d === 'board' || /board|governance/.test(d);
}
const CONF_DOC_NAME = /\b(?:board|minutes|bylaws?|by-laws|agm|governance|resolution|in[- ]camera|confidential|succession|salar\w*|payroll|compensation|offer letter|contract|employment|disciplin\w*|performance|interview|hr|human resources|personnel|termination|resignation|1[: ]?on[: ]?1|one[- ]on[- ]one)\b/i;
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
const DEPTS = ['opsmtl', 'progdev', 'opsto', 'marketing', 'fundraising', 'finance', 'hr', 'board'];
const DEPT_LABELS = {
  opsmtl: 'Ops Montreal',
  progdev: 'Program Development',
  opsto: 'Ops Toronto',
  marketing: 'Marketing',
  fundraising: 'Fundraising',
  finance: 'Finance',
  hr: 'Human Resources',
  board: 'Board'
};
const STOPWORDS = ['the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'what', 'whats', 'when', 'where', 'which', 'who', 'whom', 'why', 'how', 'do', 'does', 'did', 'doing', 'have', 'has', 'had', 'having', 'with', 'from', 'that', 'this', 'these', 'those', 'there', 'here', 'about', 'into', 'onto', 'over', 'under', 'again', 'then', 'than', 'them', 'they', 'their', 'theirs', 'our', 'ours', 'your', 'yours', 'his', 'her', 'hers', 'its', 'it', 'i', 'we', 'you', 'he', 'she', 'me', 'my', 'us', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'as', 'up', 'out', 'off', 'so', 'if', 'not', 'no', 'any', 'all', 'some', 'can', 'could', 'should', 'would', 'will', 'shall', 'may', 'might', 'must', 'happening', 'happened', 'happen', 'going', 'recently', 'recent', 'latest', 'update', 'updates', 'status', 'tell', 'know', 'anything', 'something', 'much', 'many', 'please', 'request', 'task'];
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
        description: 'The reply in the Welfare Avenue voice: grounded in the context, concise, friendly, light Markdown (bold, - bullets, [label](link) links, never a bare address), at most two :wa-...: emojis, no em dashes. When you proposed actions this turn, say what is ready and that they confirm it below; never claim it is already filed or done.'
      },
      sources: {
        type: 'array',
        items: { type: 'string' },
        description: 'Short labels of the sources used (a meeting and its date, a document title). No addresses. Empty if none.'
      }
    },
    required: ['answer', 'sources']
  }
};
const CLOSE_TASK_TOOL = {
  name: 'close_task',
  description: 'PROPOSE closing (marking done) one open task, ONLY when the latest user message explicitly asks. task_id must be a numeric id from the OPEN TASKS list. The user will confirm before it happens.',
  input_schema: {
    type: 'object',
    properties: {
      task_id: { type: 'integer' },
      note: { type: 'string' }
    },
    required: ['task_id']
  }
};
const COMPLETE_REQUEST_TOOL = {
  name: 'complete_request',
  description: 'PROPOSE marking one open request done, ONLY when the latest user message explicitly asks. request_id must be a numeric id from the OPEN REQUESTS list. The user will confirm before it happens.',
  input_schema: {
    type: 'object',
    properties: {
      request_id: { type: 'integer' }
    },
    required: ['request_id']
  }
};
const SET_REQUEST_STATUS_TOOL = {
  name: 'set_request_status',
  description: 'PROPOSE changing the status of one open request, ONLY when the latest user message explicitly asks. The user will confirm before it happens.',
  input_schema: {
    type: 'object',
    properties: {
      request_id: { type: 'integer' },
      status: { type: 'string' }
    },
    required: ['request_id', 'status']
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
        description: 'One of: opsmtl, progdev, opsto, marketing, fundraising, finance, hr, board. The department that should action it (finance: reimbursements, purchase approvals, invoices and receipts; fundraising: grants, donors, sponsors and events).'
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
    required: ['type_key', 'department', 'title', 'details']
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
        description: 'One of: opsmtl, progdev, opsto, marketing, fundraising, finance, hr, board (finance is the books, apart from fundraising).'
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
    required: ['department', 'title']
  }
};
const BANK_TASK_TOOL = {
  name: 'bank_task',
  description: 'PROPOSE moving one open task to the bank: it leaves every board, list and count and comes back on bank_until. Use ONLY when the latest user message asks to park, bank, shelve or put off a task for three months or more. task_id must be a numeric id from the OPEN TASKS list. The user will confirm (and can change the date) before it happens.',
  input_schema: {
    type: 'object',
    properties: {
      task_id: { type: 'integer' },
      title: {
        type: 'string',
        description: 'The task title, copied from the OPEN TASKS list.'
      },
      bank_until: {
        type: 'string',
        description: 'YYYY-MM-DD, the day it should come back: the first day of the month or season the user named, or three months from today when they did not say. At least a month away.'
      },
      reason: {
        type: 'string',
        description: 'One short line on why it waits, from what the user said (for example "After the March gala"). Empty if they gave no reason.'
      }
    },
    required: ['task_id', 'bank_until']
  }
};
const ACTION_TOOLS = [
  CLOSE_TASK_TOOL,
  BANK_TASK_TOOL,
  COMPLETE_REQUEST_TOOL,
  SET_REQUEST_STATUS_TOOL,
  CREATE_REQUEST_TOOL,
  CREATE_TASK_TOOL
];
const MODELS = ['claude-sonnet-5', 'claude-sonnet-4-5', 'claude-sonnet-4-20250514'];
const OR_MODELS = ['z-ai/glm-5.3', 'deepseek/deepseek-v4-pro-0813', 'qwen/qwen3.8-27b'];
const SYSTEM = `You are Ask the Hub, the assistant inside Welfare Avenue's staff Hub. Welfare Avenue is a youth-powered charity in Montreal and Toronto (meals, servings, community). You talk to the team like a warm, switched-on colleague.

GROUNDING. Answer ONLY from the provided context. If the context does not hold the answer, say so in one line and point to where to look (a Hub page, a team, a person). Never guess names, numbers or dates. For Welfare Avenue's past, use the OUR STORY blocks and KEY FACTS; give dates and say so when two sources disagree.

CONFIDENTIAL, NO EXCEPTIONS (whoever is asking, the founder and the co-EDs included). Never say, hint at, confirm or deny anything about: leadership changes (anyone's ED, co-ED, chair or president role, someone stepping back, succession, who replaces whom); board meetings, board decisions and board documents; anyone's personal or HR situation (someone leaving, quitting or being let go, performance, discipline, pay, health, time off reasons); one-on-ones and leaders-only meetings. If the question goes there, or the only answer you could give does, reply exactly: "${CONF_ANSWER}". Do not explain what you left out or why. When you draft a task or request that comes from sensitive ground, keep its title and details high level and neutral (for example "Prepare role handover notes", never who is leaving or why).

VOICE (Welfare Avenue's): concise, to the point, friendly. Lead with the answer in the first sentence; no "Great question", no preamble, no sign-off. First names for people. Plain words, short sentences, no charity boilerplate, no hedging. Never use em dashes or en dashes; use commas, colons or parentheses. Aim for 40 to 90 words; go longer only for a list the person asked for. Give credit by name when someone did the work. Never show internal ids (task 646, request 19) unless the person asks to act on one; name the thing instead.

FORMAT (the Hub renders this, so use it): open with a plain sentence that answers; **bold** a short phrase (two to six words) for the one thing that matters most, never a whole sentence; short bullet lists with "- " for three or more items, at most five (say how many more and link the page); a blank line between short paragraphs. Links are always Markdown, [label](address), with a short human label ("the agenda", "the Loom", "the grant doc"), and you NEVER paste a bare web address. Link the Hub's own pages the same way with these addresses: [Home](#mypage), [Avenue Academy](#training), [Calendar](#calendar), [Requests](#requests), [Transcript archive](#transcripts), [Document finder](#documents), [Our story](#ourstory), [Org chart](#orgchart), [The bank](#bank), [Agendas](#agendas), [Important info](#importantinfo), [Projects](#projects), [Goals](#orggoals), and the team pages [Ops Montreal](#opsmtl), [Ops Toronto](#opsto), [Program Development](#progdev), [Marketing](#marketing), [Fundraising](#fundraising), [Human Resources](#hr). When a DRIVE DOCUMENTS or DOCUMENT FINDER entry informs the answer, link it. Cite a meeting inline in plain words, like (Ops MTL meeting, Jul 13).

EMOJIS: at most two per answer, only from Welfare Avenue's own set, written exactly like this: :wa-heart-gold: (thanks, warmth), :wa-heart-purple: (care), :wa-heart-beat: (big love, a win), :wa-star-gold: (a highlight), :wa-star-pop: (a win, a milestone), :wa-e-moves: (momentum, moving forward), :wa-arrow-go: (a next step), :wa-flowers-gold: (welcome, a celebration), :wa-asterisk-gold: (a heads-up, a note). Put an emoji at the end of a sentence, never in the middle of a link or a list label. Skip emojis on bad news or a short factual answer.

ACTIONS. You can PROPOSE actions with the action tools: file a new request (create_request), add a task (create_task), close a task, move a task to the bank (bank_task: work the user wants to park for three months or more), complete a request, or change a request status. Nothing you propose happens immediately: the Hub shows a confirmation card and it only runs if they confirm. Propose an action ONLY when the latest user message asks for it. Draft titles and details faithfully from what the user said; never invent names, amounts or dates. Use only ids present in the context lists. In your answer, say what is ready to confirm below; never say it is already filed, added, closed or done.

Always finish by calling answer_question.`;
let ASK_AUTH = ''; // the caller's Authorization header, for actions that run as them (bank_task)
let ASK_WHO = ''; // who is asking (email), for the AI usage log (Admin > Adoption)
async function anthropicCall(key, messages, tools, toolChoice) {
  let lastErr = '';
  for (const model of MODELS){
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'x-wa-task': 'brain',
        'x-wa-caller': 'ask' + (ASK_WHO ? ':' + ASK_WHO : ''),
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
  if (name === 'bank_task') return 'Move to the bank: ' + (input.title || 'task #' + input.task_id) + (input.bank_until ? ' (back ' + input.bank_until + ')' : '');
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
    const { data: pr } = await svc.from('projects').select('id, department').is('banked_at', null).eq('id', Number(input.project_id)).maybeSingle();
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
async function doBankTask(input) {
  const taskId = Number(input?.task_id);
  if (!Number.isInteger(taskId) || taskId <= 0) return {
    error: 'invalid task_id'
  };
  const until = typeof input?.bank_until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.bank_until.trim()) ? input.bank_until.trim() : '';
  if (!until) return {
    error: 'pick the day it should come back'
  };
  if (!ASK_AUTH.startsWith('Bearer ')) return {
    error: 'sign in to the Hub to bank a task'
  };
  const reason = typeof input?.reason === 'string' ? input.reason.trim().slice(0, 280) : '';
  // as the signed-in person: the database checks they can bank it and can see it
  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: {
      headers: {
        Authorization: ASK_AUTH
      }
    }
  });
  const { data: t } = await svc.from('dept_tasks').select('id, title').eq('id', taskId).maybeSingle();
  const { data, error } = await asUser.rpc('bank_task', {
    p_id: taskId,
    p_until: until,
    p_note: reason || null
  });
  if (error) return {
    error: error.message
  };
  const n = Number(data?.banked || 1);
  return {
    ok: true,
    detail: 'In the bank until ' + until + ': ' + (t?.title || 'task #' + taskId) + (n > 1 ? ' (with ' + (n - 1) + ' subtask' + (n === 2 ? '' : 's') + ')' : '') + '. It comes back on its date; find it under Strategy, The bank.'
  };
}
async function execAction(name, input, caller, isBoard) {
  try {
    if (name === 'close_task') return await doCloseTask(input, caller, isBoard);
    if (name === 'bank_task') return await doBankTask(input);
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
    const body = await callModel(key, orKey, messages, allTools, { type: 'auto' });
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
/* wave226: the last checks before an answer leaves. A bare address becomes a labelled link, dashes become commas, and an answer
   that touches an off-limits topic is replaced whole by the standard reply (a proposal still shows its card). */
function linkLabel(u) {
  const h = (()=>{ try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return ''; } })();
  if (/docs\.google\.com/.test(u)) return /spreadsheets/.test(u) ? 'the sheet' : /presentation/.test(u) ? 'the slides' : /forms/.test(u) ? 'the form' : 'the doc';
  if (/drive\.google\.com/.test(h)) return 'the file in Drive';
  if (/loom\.com/.test(h)) return 'the Loom';
  if (/canva\.com/.test(h)) return 'the Canva design';
  if (/welfareavenue\.com$/.test(h) && /^hub\./.test(h)) return 'the Hub';
  if (/welfareavenue\.com$/.test(h)) return 'our website';
  if (/slack\.com/.test(h)) return 'the Slack thread';
  return h ? h : 'the link';
}
/* v15c: an answer is checked a line at a time, keeping its Markdown: a line that touches an off-limits topic loses that
   sentence (a list item that has nothing left goes); only an answer with nothing worth saying left becomes the
   standard reply. Internal ids the model still shows ("(task 646)", "(open requests 8 and 7)") come out. */
function answerScrub(t) {
  const lines = String(t || '').split('\n').map((ln)=>{
    if (!confHit(ln)) return ln;
    const m = /^(\s*(?:[-*•]|\d{1,2}[.)])\s+)?(.*)$/.exec(ln) || ['', '', ln];
    const kept = String(m[2] || '').split(/(?<=[.!?])\s+/).filter((x)=>x && !confHit(x)).join(' ').trim();
    return kept ? (m[1] || '') + kept : null;
  }).filter((ln)=>ln !== null);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
function finishAnswer(text, proposals) {
  let t = String(text || '').trim();
  if (!t) return t;
  if (t === CONF_ANSWER) return t;
  if (confHit(t)) {
    const kept = answerScrub(t);
    if (kept.replace(/[^a-z]/gi, '').length < 40 || confHit(kept)) return (proposals && proposals.length) ? 'Ready for you to check and confirm below :wa-arrow-go:' : CONF_ANSWER;
    t = kept;
  }
  t = t.replace(/\s*\((?:open\s+)?(?:tasks?|requests?)\s+#?\d+(?:\s*(?:,|and|&)\s*#?\d+)*\)/gi, '');
  /* bare addresses (not already inside a Markdown link) become labelled links */
  t = t.replace(/(^|[^(\[\]"'<])(https?:\/\/[^\s)<>\]]+[^\s)<>\].,;:!?'"])/g, (_m, pre, u)=>pre + '[' + linkLabel(u) + '](' + u + ')');
  /* no em or en dashes (WA voice) */
  t = t.replace(/\s*[—–]\s*/g, ', ').replace(/,\s*,/g, ',');
  return t;
}
function cleanHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const turns = [];
  for (const t of raw.slice(-6)){
    if (!t || typeof t !== 'object') continue;
    const role = t.role;
    const content = t.content;
    if ((role === 'user' || role === 'assistant') && typeof content === 'string' && content.trim() && !confHit(content)) {
      turns.push({
        role,
        content: content.slice(0, 2000)
      });
    }
  }
  while(turns.length && turns[0].role !== 'user')turns.shift();
  return turns;
}
/* ---------- our story (wave140) ---------- */
const STORY_SKIP = ['welfare', 'avenue', 'hub', 'give', 'show', 'list', 'find', 'want', 'need', 'just', 'like', 'also', 'ever', 'thing', 'things', 'stuff', 'someone', 'people'];
const STEM_SUFFIXES = ['ations', 'ships', 'ation', 'ings', 'ship', 'ies', 'ers', 'ing', 'ed', 'es', 'er', 's'];
function fold(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
/* the question's words, folded and cut to a stem so plurals and endings still match (charities finds charity, registration finds
   registered): a common ending comes off, then a long word keeps its first six letters */
function storyTerms(question) {
  const out = [];
  for (const w of fold(question).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
    if (w.length < 3 || /^\d+$/.test(w) || STOPWORDS.indexOf(w) >= 0 || STORY_SKIP.indexOf(w) >= 0) continue;
    let s = w;
    for (const suf of STEM_SUFFIXES){ if (s.endsWith(suf) && s.length - suf.length >= 4 && !(suf === 's' && s.endsWith('ss'))) { s = s.slice(0, -suf.length); break; } }
    if (s.length >= 7) s = s.slice(0, 6);
    if (out.indexOf(s) < 0) out.push(s);
  }
  return out.slice(0, 10);
}
async function storyAccess(email, isBoard) {
  let leader = false;
  try {
    if (email) {
      const { data } = await svc.from('hub_roles').select('role').eq('email', email).maybeSingle();
      leader = !!data && (data.role === 'admin' || data.role === 'leader');
    }
  } catch (_) {}
  return { lead: leader || !!isBoard, docsLead: leader };
}
function whenText(date, prec) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date || ''));
  if (!m) return '';
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (prec === 'year') return m[1];
  if (prec === 'month' || prec === 'season') return MON[Number(m[2]) - 1] + ' ' + m[1];
  return Number(m[3]) + ' ' + MON[Number(m[2]) - 1] + ' ' + m[1];
}
function numbersLine(n) {
  if (!n || typeof n !== 'object') return '';
  const f = (v)=>Number(v).toLocaleString('en-CA');
  const out = [];
  if (n.meals) out.push(f(n.meals) + ' meals');
  if (n.people_helped) out.push(f(n.people_helped) + ' people helped');
  if (n.volunteers) out.push(f(n.volunteers) + ' volunteers');
  if (n.attendees) out.push(f(n.attendees) + ' attendees');
  if (n.raised_cad) out.push('$' + f(n.raised_cad) + ' raised');
  return out.join(', ');
}
const REL_WORDS = /\b(partner|partners|partnership|partnerships|sponsor|sponsors|sponsored|funder|funders|donor|donors|collaborat\w*|organi[sz]ations?)\b/;
const STORY_WORDS = /\b(story|history|historic\w*|timeline|founded|founding|founder|began|begin|beginning|beginnings|origin|origins|milestones?|achievements?|anniversary|journey|since 2020|so far|over the years|past years)\b/;
async function storyBlock(question, acc) {
  const q = fold(question);
  const terms = storyTerms(question);
  const years = Array.from(new Set((q.match(/\b20(19|2[0-7])\b/g) || []).map(Number)));
  const story = STORY_WORDS.test(q), partnersAsked = REL_WORDS.test(q);
  if (!terms.length && !years.length && !story) return '';
  const { data, error } = await svc.rpc('wa_story_context', { p_terms: terms, p_years: years, p_story: story, p_partners: partnersAsked, p_lead: !!acc.lead, p_docs_lead: !!acc.docsLead, p_limit: years.length ? 16 : 10 });
  if (error || !data) return '';
  const out = [];
  const ms = data.moments || [];
  if (ms.length) {
    out.push('OUR STORY: MOMENTS (from our documents and posts since 2020; the date shows how precise it is):\n' + ms.map((m)=>{
      const when = whenText(m.date, m.precision) + (m.end ? ' to ' + whenText(m.end, m.end_precision || m.precision) : '');
      const bits = [m.city, (m.partners || []).length ? 'with ' + m.partners.slice(0, 6).join(', ') : '', numbersLine(m.numbers)].filter(Boolean).join('; ');
      const src = (m.sources || []).filter((s)=>s && (s.name || s.url)).map((s)=>(s.name || 'source') + (s.url ? ' (' + s.url + ')' : '')).join('; ');
      return '- ' + when + ' [' + m.kind + '] ' + m.title + (bits ? ' (' + bits + ')' : '') + (m.summary ? ': ' + m.summary : '') + (src ? ' Sources: ' + src : '');
    }).join('\n'));
  }
  const ys = data.years || [];
  if (ys.length) out.push('OUR STORY: THE YEARS:\n' + ys.map((y)=>'- ' + y.year + ': ' + y.summary).join('\n'));
  const ps = data.partners || [];
  if (ps.length) {
    out.push('OUR STORY: PARTNERS (organizations we worked with or approached; status active = working with us now, past = before, prospect = approached with nothing yet, declined = said no):\n' + ps.map((p)=>{
      const yrs = p.first_year && p.last_year && p.first_year !== p.last_year ? p.first_year + ' to ' + p.last_year : (p.first_year || p.last_year || '');
      return '- ' + p.name + ((p.aka || []).length ? ' (also ' + p.aka.slice(0, 3).join(', ') + ')' : '') + ': ' + [p.status, p.relationship, p.kind, p.city, yrs].filter(Boolean).join(', ') + (p.summary ? '. ' + p.summary : '') + (p.notes ? ' Note: ' + p.notes : '');
    }).join('\n'));
  }
  const ls = data.lessons || [];
  if (ls.length) out.push('OUR STORY: LESSONS LEARNED (from our own events and programs):\n' + ls.map((l)=>'- [' + l.area + (l.topic ? ', ' + l.topic : '') + (l.years ? ', ' + l.years : '') + '] ' + l.lesson + (l.context ? ' (What happened: ' + l.context + ')' : '')).join('\n'));
  const ds = data.documents || [];
  if (ds.length) out.push('OUR STORY: DOCUMENT FINDER (files in our shared drives and Canva; include the link when one informs your answer):\n' + ds.map((d)=>'- ' + d.title + ' (' + [d.kind, d.date || d.year].filter(Boolean).join(', ') + ')' + (d.summary ? ': ' + d.summary : '') + (d.reuse ? ' Reusable: ' + d.reuse + '.' : '') + (d.url ? ' Link: ' + d.url : '')).join('\n'));
  return out.join('\n\n');
}
/* organization knowledge, a piece at a time: a section's opening lines and each of its list items are pieces; the pieces that
   share the most words with the question are kept, under their headings, in the order they were written */
function bestSections(body, terms, max) {
  const score = (s)=>{
    const l = fold(s);
    let sc = 0;
    for (const k of terms){ let at = l.indexOf(k); while(at >= 0){ sc++; at = l.indexOf(k, at + k.length); } }
    return sc;
  };
  const pieces = [];
  String(body || '').split(/\n(?=#{2,3} )/).forEach((sec)=>{
    const lines = sec.split('\n');
    const head = /^#{2,3} /.test(lines[0]) ? lines[0] : '';
    let cur = [];
    const flush = ()=>{ const txt = cur.join('\n').trim(); if (txt) pieces.push({ j: pieces.length, head, s: txt, sc: score(txt) }); cur = []; };
    for (const ln of lines.slice(head ? 1 : 0)){ if (/^- /.test(ln)) flush(); cur.push(ln); }
    flush();
  });
  const pick = pieces.filter((x)=>x.sc > 0).sort((a, b)=>b.sc - a.sc || a.j - b.j);
  const keep = [];
  let n = 0;
  for (const x of pick){ const len = x.s.length + 1; if (n + len > max) continue; keep.push(x); n += len; }
  keep.sort((a, b)=>a.j - b.j);
  let text = '', last = null;
  for (const x of keep){ if (x.head && x.head !== last) { text += (text ? '\n' : '') + x.head; last = x.head; } text += (text ? '\n' : '') + x.s; }
  return { text, score: pick.reduce((a, x)=>a + x.sc, 0) };
}
/* v14: a meeting as a line of context: its kind when restricted or archive only, its summary, the passage that matches */
function meetingsText(ms) {
  const kind = (m)=>{
    const bits = [];
    if (m.visibility === 'speakers') bits.push('ONE-ON-ONE: only the people who spoke in it see it');
    else if (m.visibility === 'leadership') bits.push('LEADERS: leaders only');
    else if (m.visibility === 'private') bits.push('CONFIDENTIAL: only the people in it and the leaders');
    if (m.board_only) bits.push('board only');
    if (m.archive_only) bits.push('kept for the archive, no tasks came from it');
    return bits.length ? ' [' + bits.join('; ') + ']' : '';
  };
  const clean = (t)=>String(t || '').replace(/<\/?b>/g, '').replace(/\s+/g, ' ').trim();
  /* wave226: restricted meetings never reach the context, and what is left is scrubbed sentence by sentence */
  const open = (ms || []).filter((m)=>!confMeeting(m));
  if (!open.length) return '';
  return 'MEETINGS MATCHING THE QUESTION (best matches first, each with its summary and the passage that matches the question):\n' + open.map((m)=>{
    const sum = confScrub(clean(m.ai_summary).slice(0, 1100));
    const pas = clean(m.passage);
    const passage = pas && !confHit(pas) ? ' Passage: "' + pas.slice(0, 600) + '"' : '';
    return '- ' + (m.title || 'Untitled') + ' (' + (DEPT_LABELS[m.department] || m.department || '') + ', ' + (m.meeting_date || '') + ')' + kind(m) + ': ' + sum + passage;
  }).join('\n');
}
async function buildContext(question, isBoard, acc) {
  const kws = keywords(question);
  const parts = [];
  try {
    /* wave226: the leaders-only moments and documents never reach Ask the Hub, whoever asks */
    const story = await storyBlock(question, { lead: false, docsLead: false });
    if (story) parts.push(story.split('\n').map(confScrub).filter(Boolean).join('\n'));
  } catch (_) {}
  /* v14: the meetings that answer the question best, as the asker may read them (wa_ask_meetings runs as the asker) */
  let meetingsDone = false;
  try {
    if (ASK_AUTH.startsWith('Bearer ') && ASK_WHO && ASK_WHO !== 'system') {
      const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: ASK_AUTH } } });
      const { data: ms, error: mErr } = await asUser.rpc('wa_ask_meetings', { q: question, lim: 12 });
      if (!mErr && Array.isArray(ms)) {
        meetingsDone = true;
        const mt = meetingsText(ms);
        if (mt) parts.push(mt);
      }
    }
  } catch (_) { meetingsDone = false; }
  try {
    if (kws.length && !meetingsDone) {
      const ftsQ = svc.from('transcripts').select('id,title,meeting_date,department,ai_summary,visibility,board_only').or(OPEN_VIS).eq('board_only', false).neq('department', 'board').textSearch('fts', kws.join(' '), { type: 'websearch' });
      const { data: hits } = await ftsQ.order('meeting_date', {
        ascending: false
      }).limit(6);
      const okHits = (hits || []).filter((h)=>!confMeeting(h));
      if (okHits.length) {
        parts.push('MEETINGS MATCHING THE QUESTION:\n' + okHits.map((h)=>'- ' + (h.title || 'Untitled') + ' (' + (DEPT_LABELS[h.department] || h.department || '') + ', ' + (h.meeting_date || '') + '): ' + confScrub((h.ai_summary || '').slice(0, 900))).join('\n'));
      }
    }
  } catch (_) {}
  try {
    const recentQ = svc.from('transcripts').select('title,meeting_date,department,ai_summary,visibility,board_only').or(OPEN_VIS).eq('board_only', false).neq('department', 'board');
    const { data: recent0 } = await recentQ.order('meeting_date', {
      ascending: false
    }).limit(6);
    const recent = (recent0 || []).filter((h)=>!confMeeting(h)).slice(0, 3);
    if (recent.length) {
      parts.push('MOST RECENT MEETINGS:\n' + recent.map((h)=>'- ' + (h.title || 'Untitled') + ' (' + (DEPT_LABELS[h.department] || h.department || '') + ', ' + (h.meeting_date || '') + '): ' + confScrub((h.ai_summary || '').slice(0, 700))).join('\n'));
    }
  } catch (_) {}
  try {
    const decQ = svc.from('decisions').select('title,area,owner,suggested_move,recommendation,confidential').eq('done', false).or(OPEN_VIS).eq('board_only', false).not('confidential', 'is', true);
    const { data: decs0 } = await decQ.limit(30);
    const decs = (decs0 || []).filter((d)=>!confHit(d.title)).slice(0, 20);
    if (decs.length) {
      parts.push('OPEN EXECUTIVE DECISIONS:\n' + decs.map((d)=>'- ' + d.title + ' (area: ' + (d.area || 'unknown') + ', owner: ' + (d.owner || 'Steel and Suhaib') + ')').join('\n'));
    }
  } catch (_) {}
  try {
    const openQ = svc.from('dept_tasks').select('department,flag').is('banked_at', null).eq('done', false).or(OPEN_VIS).eq('board_only', false).not('confidential', 'is', true);
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
      const matchedQ = svc.from('dept_tasks').select('id,department,subsection,title,owner,status,flag,priority,due_date').is('banked_at', null).eq('done', false).or(OPEN_VIS).eq('board_only', false).not('confidential', 'is', true).neq('department', 'board').or(orFilter);
      const { data: matched0 } = await matchedQ.order('id', {
        ascending: false
      }).limit(12);
      const matched = (matched0 || []).filter((t)=>!confHit(t.title)).slice(0, 8);
      if (matched.length) {
        parts.push('OPEN TASKS MATCHING THE QUESTION (numeric ids usable with close_task and bank_task):\n' + matched.map((t)=>t.id + '. ' + t.title + ' (' + (DEPT_LABELS[t.department] || t.department) + ', owner: ' + (t.owner || 'unowned') + ', status: ' + (t.status || 'open') + ')').join('\n'));
      }
    }
  } catch (_) {}
  try {
    const bankQ = svc.from('dept_tasks').select('title,department,bank_until,bank_note').not('banked_at', 'is', null).is('bank_project_id', null).eq('done', false).or(OPEN_VIS).eq('board_only', false).not('confidential', 'is', true).neq('department', 'board');
    const [{ data: banked }, { data: bprojs }] = await Promise.all([
      bankQ.order('bank_until').limit(25),
      svc.from('projects').select('name,department,bank_until,bank_note').not('banked_at', 'is', null).is('parent_id', null).order('bank_until').limit(10)
    ]);
    const lines = [
      ...(bprojs || []).filter((p)=>p.department !== 'board' && !confHit(p.name)).map((p)=>'- Project: ' + p.name + ' (' + (DEPT_LABELS[p.department] || p.department) + ', back ' + p.bank_until + (p.bank_note ? ': ' + confScrub(String(p.bank_note).slice(0, 120)) : '') + ')'),
      ...(banked || []).filter((t)=>!confHit(t.title)).map((t)=>'- ' + t.title + ' (' + (DEPT_LABELS[t.department] || t.department) + ', back ' + t.bank_until + (t.bank_note ? ': ' + confScrub(String(t.bank_note).slice(0, 120)) : '') + ')')
    ];
    if (lines.length) parts.push('IN THE BANK (work parked until a date, out of every board; it comes back by itself on that date; not open tasks, so never propose closing or banking these):\n' + lines.join('\n'));
  } catch (_) {}
  try {
    const { data: reqs0 } = await svc.from('dept_requests').select('id,title,department,status,type_key,requested_by,created_at').eq('done', false).neq('type_key', 'time-off').neq('department', 'board').order('created_at', {
      ascending: false
    }).limit(30);
    const reqs = (reqs0 || []).filter((r)=>!confHit(r.title)).slice(0, 20);
    if (reqs.length) {
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
        return rows.length ? (DEPT_LABELS[d] || d) + ': ' + rows.map((m)=>{
          const role = String(m.role || '').slice(0, 40);
          return m.name + (role && !/board|chair|president|vice|co-?ed|executive director|founder|adviser|advisor/i.test(role) && !confHit(role) ? ' (' + role + ')' : '');
        }).join(', ') : null;
      }).filter(Boolean).join('\n'));
    }
  } catch (_) {}
  try {
    const { data: metas } = await svc.from('dept_meta').select('department,progress,priorities');
    if (metas && metas.length) {
      parts.push('DEPARTMENT STATE:\n' + metas.filter((m)=>m.department !== 'board').map((m)=>'- ' + (DEPT_LABELS[m.department] || m.department) + ': ' + confScrub((m.progress || '').slice(0, 200))).join('\n'));
    }
  } catch (_) {}
  try {
    if (kws.length) {
      const nameFilter = kws.map((k)=>'name.ilike.%' + k + '%').join(',');
      const textFilter = kws.map((k)=>'text_content.ilike.%' + k + '%').join(',');
      const { data: docs0 } = await svc.from('wa_drive_docs').select('file_id,name,url,mime,modified_time,text_content').or(nameFilter + ',' + textFilter).order('modified_time', {
        ascending: false
      }).limit(12);
      /* wave226: no board, HR or governance file, and nothing the Document finder keeps for leaders */
      let lead = new Set();
      try {
        const ids = (docs0 || []).map((d)=>d.file_id).filter(Boolean);
        if (ids.length) {
          const { data: ld } = await svc.from('wa_documents').select('file_id').in('file_id', ids).neq('visibility', 'everyone');
          lead = new Set((ld || []).map((x)=>x.file_id));
        }
      } catch (_) {}
      const docs = (docs0 || []).filter((d)=>!CONF_DOC_NAME.test(String(d.name || '')) && !lead.has(d.file_id)).slice(0, 5);
      if (docs.length) {
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
          snip = confScrub(snip.slice(0, 1200));
          return '## ' + d.name + (d.modified_time ? ' (updated ' + String(d.modified_time).slice(0, 10) + ')' : '') + '\nLink: ' + (d.url || '') + (snip ? '\n' + snip : '');
        }).join('\n\n'));
      }
    }
  } catch (_) {}
  try {
    const { data: kb } = await svc.from('hub_knowledge').select('slug,title,body').order('updated_at', {
      ascending: false
    }).limit(20);
    if (kb && kb.length) {
      const terms = storyTerms(question);
      const picked = kb.map((k)=>({ k, b: bestSections(k.body, terms, k.slug === 'wa-key-facts' ? 5000 : 4500) })).filter((x)=>x.b.score > 0 || x.k.slug === 'wa-key-facts').sort((a, b)=>(a.k.slug === 'wa-key-facts' ? -1 : 0) - (b.k.slug === 'wa-key-facts' ? -1 : 0) || b.b.score - a.b.score).slice(0, 3);
      const txt = picked.map((x)=>'## ' + (x.k.title || '') + '\n' + (x.b.text || (x.k.slug === 'wa-key-facts' ? String(x.k.body || '').slice(0, 2500) : '')).split('\n').map(confScrub).filter(Boolean).join('\n')).filter((s)=>s.length > 40);
      if (txt.length) parts.push('ORGANIZATION KNOWLEDGE (KEY FACTS and reference documents, the sections that match the question):\n' + txt.join('\n\n'));
    }
  } catch (_) {}
  return parts.join('\n\n').slice(0, 32000);
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: CORS
  });
  const auth = await authorize(req);
  ASK_AUTH = req.headers.get('Authorization') || '';
  ASK_WHO = (auth && auth.ok && auth.who) ? String(auth.who).toLowerCase().slice(0, 80) : '';
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
  /* wave226: an off-limits question gets the same reply every time, before anything is read or any model is called */
  if (confHit(question)) {
    return json({ answer: CONF_ANSWER, sources: [], proposals: [], actions_done: 0, confidential: true });
  }
  const history = cleanHistory(body.history);
  try {
    const acc = await storyAccess(auth.email, isBoard);
    const context = await buildContext(question, isBoard, acc);
    const out = await runAgent(history, context || 'No matching data was found in the dashboard database for this question.', question);
    const answer = finishAnswer(out.answer, out.proposals);
    const conf = answer === CONF_ANSWER;
    return json({
      answer,
      sources: conf ? [] : (out.sources || []).filter((x)=>!confHit(x)),
      proposals: out.proposals,
      actions_done: 0,
      confidential: conf || undefined
    });
  } catch (e) {
    return json({
      error: String(e)
    }, 500);
  }
});
