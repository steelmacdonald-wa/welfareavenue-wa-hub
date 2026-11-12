// v17 (12/11/26, wave324): Ask the Hub looks things up and does more. Steel: "read event data like confirmations of volunteers,
// interactions with companies/supporters/donors, get details on requests, get better at helping individuals to complete tasks,
// navigate the hub very well and know all its abilities and actions, even maybe send slack messages, get project progress
// reports". Six look-up tools the model calls as it needs them (look_up_request, look_up_task, project_report,
// volunteer_events, crm_lookup, hub_guide), each limited by what the asker may open in the Hub (wa_ask_access: the same
// functions the database's row rules use), each result passed through the confidentiality filter; up to four rounds, six
// look-ups a question. Four more confirm-first actions: send_slack_message (from WA HUB, naming who asked, team list only,
// ten a day), update_task, add_subtasks and request_access. Nothing new is kept: the words of a Slack message are not stored.
// v16 (12/11/26, wave323): Ask the Hub knows who is asking, and can be asked from Slack. (1) The context opens with WHO IS
// ASKING (the roster name and team), today's date in Toronto, THEIR OPEN TASKS (assigned to them or carrying their name as a
// whole word; overdue first; the same visibility rules as every other task block) and the requests waiting on them. Before
// this the model was never told who "my" was or what day it was, so "which of my tasks are overdue?" could not be answered.
// (2) A trusted Hub function (slack-command) may ask for one active roster person: x-wa-secret (the vault's WA_TRIGGER_SECRET,
// which never reaches a browser) plus x-wa-as: their email. That path carries no sign-in of theirs, so the meetings come from
// the open-visibility search (never wa_ask_meetings as someone else) and a task cannot be banked from there.
// v16b (12/11/26): that path takes a Welfare Avenue account only, as the sign-in path always has. A roster person with any
// other email cannot use Ask the Hub in the Hub, so they cannot from Slack either.
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
    if (given && given === await getSecret('WA_TRIGGER_SECRET')) {
      /* v16: a trusted Hub function asking for one roster person (Ask the Hub in Slack). Only an active roster email passes,
         and (v16b) only a Welfare Avenue account: the same rule as the sign-in path below, so Slack opens nothing the Hub does not. */
      const as = (req.headers.get('x-wa-as') || '').trim().toLowerCase();
      if (as) {
        if (!as.endsWith('@welfareavenue.com')) return { ok: false, who: '', email: '' };
        const { data: roster } = await svc.from('team_members').select('email, active').eq('active', true);
        const hit = (roster || []).find((m)=>m.active === true && String(m.email || '').trim().toLowerCase() === as);
        if (!hit) return { ok: false, who: '', email: '' };
        return { ok: true, who: as.split('@')[0], email: as, via: (req.headers.get('x-wa-via') || 'server').toLowerCase().replace(/[^a-z]/g, '').slice(0, 12) || 'server' };
      }
      return {
        ok: true,
        who: 'system',
        email: ''
      };
    }
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
        description: 'Optional: a team member name from TEAM MEMBERS, only if the user named one. "me", "my" or "I" means the person in WHO IS ASKING: use their name.'
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

WHO IS ASKING. The context opens with who is asking, today's date and THEIR OPEN TASKS. "I", "me" and "my" mean that person. For questions about their own work (what is overdue, what to focus on, what is due this week, help finishing a task) answer from THEIR OPEN TASKS and REQUESTS WAITING ON THEM: what is past its date first, then what is due soonest, and say plainly when nothing is late. Work out "overdue", "today" and "this week" from TODAY IS, never from memory. If the context says they are not on the team list, say you cannot tell which tasks are theirs from here and point them to [Home](#mypage).

ACTIONS. You can PROPOSE actions with the action tools: file a new request (create_request), add a task (create_task), close a task, move a task to the bank (bank_task: work the user wants to park for three months or more), complete a request, change a request status, change a task (update_task), add steps under a task (add_subtasks), ask for access to a page (request_access), or send someone on the team a Slack message from WA HUB (send_slack_message: only when they ask to message, tell, ping or remind a person; the words are theirs, short, and the card shows them exactly). Nothing you propose happens immediately: the Hub shows a confirmation card and it only runs if they confirm. Propose an action ONLY when the latest user message asks for it. Draft titles and details faithfully from what the user said; never invent names, amounts or dates. A new task goes on the board of the team the user names; when they name none, use the asker's own team from WHO IS ASKING; when WHO IS ASKING shows no team, ask which team's board it belongs on before proposing it, and never choose the Board team unless they name it. Use only ids present in the context lists. In your answer, say what is ready to confirm below; never say it is already filed, added, closed or done.

LOOKING THINGS UP. Besides the context you have look-up tools: look_up_request (a request in full), look_up_task (a task in full, with its steps and comments), project_report (how a project is going), volunteer_events (servings and events: who is confirmed, waiting or cannot make it, against the spots), crm_lookup (a person, donor, supporter or organization and their history with us) and hub_guide (where things are in the Hub and whether this person can open them). Use them whenever the answer needs more than the context holds; never guess what they would return. They only show what this person may open in the Hub: when a result says NOT ALLOWED, say plainly that it is outside their access and offer to ask an admin for it (request_access). Treat what they return like the context: grounded, no phone numbers or emails in answers, link the item with its link.

HELPING SOMEONE FINISH. When someone wants help with a task, look it up first, then give the next one or two concrete steps, who to talk to and where in the Hub to do it; offer to break it into steps (add_subtasks), move its date or hand it over (update_task), or ping someone (send_slack_message). For "how do I" and "where is", use hub_guide and link the page.

WHAT YOU CAN DO, when asked: answer about meetings, tasks, requests, projects, goals, our story, servings and volunteers, the CRM and partners (for those with access), and where things are in the Hub; and, after the person confirms a card, file a request, add a task, close a task, move one to the bank (in the Hub only), change a request's status or mark it done, change a task's date, owner or notes, break a task into steps, ask an admin for access to a page, and send a teammate a Slack message from WA HUB with their name on it.

Always finish by calling answer_question.`
/* ---------- v17 (wave324): Ask the Hub looks things up ----------
   Steel (12/11/26): read event data and volunteer confirmations, the CRM's history with companies, supporters and donors,
   the details of a request, help people finish their tasks, know the Hub's pages and abilities, report on a project. His
   choices: the CRM for the people who can open the CRM page, in the Hub and in Slack. What one person may see comes from
   wa_ask_access(email): the same functions the database's row rules use, so Slack (where there is no sign-in of theirs) and
   the Hub answer by the same rules. Every look-up result passes the confidentiality filter before the model reads it. */
const NO_FACTS = { staff: false, pages: {} };
async function accessFacts(email) {
  if (!email) return NO_FACTS;
  try {
    const { data, error } = await svc.rpc('wa_ask_access', { p_email: email });
    if (error || !data || typeof data !== 'object') return NO_FACTS;
    if (data.role === 'blocked') return NO_FACTS;
    return Object.assign({ pages: {} }, data);
  } catch (_) { return NO_FACTS; }
}
function canPage(f, key) { return !!(f && f.staff === true && f.pages && f.pages[key] === true); }
const PAGE_LABEL = { mypage: 'Home', calendar: 'Calendar', requests: 'Requests', overview: 'Executive dashboard', dashboard: 'Delivery numbers', create: 'Create studio', photos: 'Photo library', brain: 'The Brain', importantinfo: 'Important info', ourstory: 'Our story', partners: 'Partners', documents: 'Document finder', orggoals: 'Goals and the Strategy Library', projects: 'Projects', goalmap: 'Goal alignment', bank: 'The Task Bank', opsmtl: 'Operations Montreal', volunteering: 'Volunteer Manager', toronto: 'Toronto Volunteers', progdev: 'Program Development', opsto: 'Operations Toronto', marketing: 'Marketing', contentcal: 'Content calendar', socialstats: 'Analytics', studio: 'Content Studio', fundraising: 'Fundraising', fundevents: 'Events calendar', grants: 'Grants', fund: 'Fundraising app', finances: 'Finance', hr: 'Human Resources', hrcentre: 'HR centre', governance: 'Board overview', committees: 'Committees', transcripts: 'Transcript archive', agendas: 'Agendas', hubmail: 'Hub inbox', orgchart: 'Org chart', training: 'Avenue Academy', crm: 'CRM', activity: 'Activity', adminpanel: 'Admin', programs: 'Program Builder' };
const LOOKUP_DONE = (s)=>String(s || '').split('\n').map(confScrub).filter(Boolean).join('\n').slice(0, 7000);
function words(q) { return storyTerms(q || '').filter((w)=>w.length >= 3).slice(0, 6); }
function likeAny(col, ws) { return ws.map((w)=>col + '.ilike.%' + w.replace(/[%,()]/g, '') + '%').join(','); }
function taskOpenOk(t) {
  if (!t || t.banked_at || t.board_only === true || t.confidential === true || t.department === 'board') return false;
  if (t.visibility && t.visibility !== 'department') return false;
  return !confHit(t.title);
}
const REQ_HIDDEN_TYPES = ['time-off', 'hiring-request', 'onboarding-request', 'access-request'];
const REQ_HIDDEN_DEPTS = ['hr', 'board'];
const PRIVATE_FIELD = /e-?mail|phone|t[e\u00e9]l[e\u00e9]phone|postal|address|adresse|code postal|birth|date of birth|age\b|16 ou plus|16 or older|sin\b|password/i;
function reqOk(r) { return r && REQ_HIDDEN_TYPES.indexOf(r.type_key) < 0 && REQ_HIDDEN_DEPTS.indexOf(r.department) < 0 && !confHit(r.title); }

async function lookRequest(input, f) {
  if (!canPage(f, 'requests')) return 'NOT ALLOWED: this person cannot open Requests. Say so and offer to ask for access.';
  const id = Number(input.request_id);
  let rows = [];
  if (Number.isInteger(id) && id > 0) {
    const { data } = await svc.from('dept_requests').select('*').eq('id', id).limit(1);
    rows = data || [];
  } else {
    const ws = words(input.search);
    if (!ws.length) return 'Give a request number or a few words from its title.';
    const { data } = await svc.from('dept_requests').select('*').or(likeAny('title', ws)).order('created_at', { ascending: false }).limit(12);
    rows = data || [];
  }
  rows = rows.filter(reqOk).slice(0, 4);
  if (!rows.length) return 'No request matches that (some kinds, like time off, hiring and HR requests, are never shown here).';
  const types = {};
  try { const { data: ts } = await svc.from('request_types').select('key,label,fields,statuses'); (ts || []).forEach((t)=>{ types[t.key] = t; }); } catch (_) {}
  const out = [];
  for (const r of rows) {
    const t = types[r.type_key] || {};
    const labels = {};
    (Array.isArray(t.fields) ? t.fields : []).forEach((x)=>{ if (x && x.name) labels[x.name] = x.label || x.name; });
    const lines = ['REQUEST ' + r.id + ': ' + (r.title || 'Untitled') + ' (link: #requests/r/' + r.id + ')',
      'Type: ' + (t.label || r.type_key || 'other') + '. Team: ' + (DEPT_LABELS[r.department] || r.department) + '. Status: ' + (r.done ? 'done' + (r.done_at ? ' on ' + String(r.done_at).slice(0, 10) : '') : (r.status || 'new')) + (Array.isArray(t.statuses) && t.statuses.length ? ' (the steps: ' + t.statuses.join(' > ') + ')' : '') + '.',
      'Filed ' + String(r.created_at || '').slice(0, 10) + ' by ' + String(r.requested_by || 'someone').replace(/\s*<[^>]*>/g, '') + '. Handled by: ' + (r.assignee || 'nobody yet') + '.' + (r.needed_by ? ' Needed by ' + r.needed_by + '.' : '') + (r.priority ? ' Priority: ' + r.priority + '.' : '')];
    const d = r.details;
    if (d && typeof d === 'object' && !Array.isArray(d)) {
      const kv = Object.keys(d).filter((k)=>!PRIVATE_FIELD.test(k) && !PRIVATE_FIELD.test(labels[k] || '')).map((k)=>{
        const v = d[k]; const s = typeof v === 'string' ? v : JSON.stringify(v);
        return '- ' + (labels[k] || k) + ': ' + String(s || '').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]').slice(0, 300);
      });
      if (kv.length) lines.push('What the form says:\n' + kv.slice(0, 14).join('\n'));
    } else if (typeof d === 'string' && d.trim()) lines.push('Details: ' + d.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]').slice(0, 900));
    try {
      const { data: ns } = await svc.from('request_notes').select('author,body,created_at').eq('request_id', r.id).order('created_at', { ascending: true }).limit(8);
      if ((ns || []).length) lines.push('Notes:\n' + ns.map((n)=>'- ' + String(n.created_at || '').slice(0, 10) + ' ' + (n.author || 'someone') + ': ' + String(n.body || '').slice(0, 300)).join('\n'));
    } catch (_) {}
    out.push(lines.join('\n'));
  }
  return out.join('\n\n');
}

async function lookTask(input, f) {
  if (!f || f.staff !== true) return 'NOT ALLOWED.';
  const id = Number(input.task_id);
  let rows = [];
  if (Number.isInteger(id) && id > 0) {
    const { data } = await svc.from('dept_tasks').select('*').eq('id', id).limit(1); rows = data || [];
  } else {
    const ws = words(input.search);
    if (!ws.length) return 'Give a task number or a few words from its title.';
    const { data } = await svc.from('dept_tasks').select('*').is('banked_at', null).eq('done', false).or(likeAny('title', ws)).order('id', { ascending: false }).limit(12); rows = data || [];
  }
  rows = rows.filter(taskOpenOk).slice(0, 3);
  if (!rows.length) return 'No open task the Hub can show matches that.';
  const out = [];
  for (const t of rows) {
    const lines = ['TASK ' + t.id + ': ' + t.title + ' (link: #task/' + t.id + ')',
      'Team: ' + (DEPT_LABELS[t.department] || t.department) + '. Owner: ' + (t.owner || 'nobody') + '. Status: ' + (t.done ? 'done' : (t.status || 'Open')) + (t.due_date ? '. Due ' + t.due_date : '. No due date') + (t.flag ? '. Flagged' : '') + (t.priority ? '. Priority' : '') + '.'];
    if (t.description) lines.push('Description: ' + String(t.description).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 900));
    if (t.project_id) { try { const { data: p } = await svc.from('projects').select('id,name,department').eq('id', t.project_id).maybeSingle(); if (p && p.department !== 'board' && !confHit(p.name)) lines.push('Project: ' + p.name + ' (link: #project/' + p.id + ')'); } catch (_) {} }
    try {
      const { data: subs } = await svc.from('dept_tasks').select('id,title,done,owner,due_date,board_only,confidential,visibility,banked_at,department').eq('parent_task_id', t.id).limit(20);
      const ok = (subs || []).filter(taskOpenOk);
      if (ok.length) lines.push('Subtasks:\n' + ok.map((s)=>'- ' + (s.done ? '[done] ' : '[open] ') + s.title + (s.owner ? ' (' + s.owner + ')' : '') + (s.due_date ? ', due ' + s.due_date : '')).join('\n'));
    } catch (_) {}
    try {
      const { data: cs } = await svc.from('task_comments').select('body,author,created_at,visibility,source').eq('task_id', t.id).order('created_at', { ascending: false }).limit(8);
      const ok = (cs || []).filter((c)=>!c.visibility && !confHit(c.body));
      if (ok.length) lines.push('Latest comments:\n' + ok.reverse().map((c)=>'- ' + String(c.created_at || '').slice(0, 10) + ' ' + (c.author || 'someone') + ': ' + String(c.body || '').replace(/\s+/g, ' ').slice(0, 280)).join('\n'));
    } catch (_) {}
    out.push(lines.join('\n'));
  }
  return out.join('\n\n');
}

async function lookProject(input, f, today) {
  if (!canPage(f, 'projects')) return 'NOT ALLOWED: this person cannot open Projects.';
  const { data: ps0 } = await svc.from('projects').select('id,name,department,status,description,parent_id,leads,goal_id,banked_at').is('banked_at', null).neq('department', 'board').limit(200);
  const ps = (ps0 || []).filter((p)=>!confHit(p.name));
  const q = fold(input.project || '').replace(/[^a-z0-9 ]/g, ' ').trim();
  if (!q) {
    return 'PROJECTS (' + ps.length + '; ask about one by name for its report):\n' + ps.filter((p)=>!p.parent_id).map((p)=>'- ' + p.name + ' (' + (DEPT_LABELS[p.department] || p.department) + ', link: #project/' + p.id + ')').join('\n');
  }
  const qw = q.split(/\s+/).filter((w)=>w.length >= 3);
  const score = (p)=>{ const n = fold(p.name); if (n === q) return 100; if (n.indexOf(q) >= 0) return 50; return qw.filter((w)=>n.indexOf(w) >= 0).length; };
  const hits = ps.map((p)=>({ p, s: score(p) })).filter((x)=>x.s > 0).sort((a, b)=>b.s - a.s);
  if (!hits.length) return 'No project matches "' + input.project + '". Projects: ' + ps.slice(0, 25).map((p)=>p.name).join(', ');
  if (hits.length > 1 && hits[0].s === hits[1].s && hits[0].s < 50) return 'Several projects match: ' + hits.slice(0, 6).map((x)=>x.p.name).join(', ') + '. Ask which one.';
  const p = hits[0].p;
  const kids = ps.filter((c)=>c.parent_id === p.id);
  const ids = [p.id].concat(kids.map((c)=>c.id));
  const { data: ts0 } = await svc.from('dept_tasks').select('id,title,owner,due_date,done,closed_at,flag,priority,department,board_only,confidential,visibility,banked_at,project_id,parent_task_id').in('project_id', ids).is('banked_at', null).limit(1000);
  const ts = (ts0 || []).filter(taskOpenOk);
  const open = ts.filter((t)=>!t.done), done = ts.filter((t)=>t.done);
  const late = open.filter((t)=>t.due_date && t.due_date < today);
  const pct = ts.length ? Math.round(100 * done.length / ts.length) : 0;
  const owners = {};
  open.forEach((t)=>{ const o = (t.owner || 'nobody').trim(); owners[o] = (owners[o] || 0) + 1; });
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const recent = done.filter((t)=>t.closed_at && t.closed_at >= since).sort((a, b)=>String(b.closed_at).localeCompare(String(a.closed_at)));
  const next = open.filter((t)=>t.due_date && t.due_date >= today).sort((a, b)=>a.due_date.localeCompare(b.due_date));
  const leads = Array.isArray(p.leads) ? p.leads.filter(Boolean) : [];
  const lines = ['PROJECT REPORT: ' + p.name + ' (' + (DEPT_LABELS[p.department] || p.department) + ', link: #project/' + p.id + ')' + (leads.length ? '. Lead: ' + leads.join(', ') : '') + '.',
    p.description ? 'About: ' + String(p.description).slice(0, 400) : '',
    'Tasks: ' + ts.length + ' in all, ' + done.length + ' done (' + pct + '%), ' + open.length + ' open, ' + late.length + ' past their date, ' + open.filter((t)=>t.flag).length + ' flagged.' + (kids.length ? ' Sub-projects: ' + kids.map((k)=>k.name).join(', ') + '.' : ''),
    Object.keys(owners).length ? 'Open work by person: ' + Object.entries(owners).sort((a, b)=>b[1] - a[1]).map((x)=>x[0] + ' ' + x[1]).join(', ') + '.' : '',
    late.length ? 'Past their date:\n' + late.slice(0, 8).map((t)=>'- ' + t.title + ' (' + (t.owner || 'nobody') + ', was due ' + t.due_date + ')').join('\n') : 'Nothing is past its date.',
    next.length ? 'Coming up:\n' + next.slice(0, 6).map((t)=>'- ' + t.title + ' (' + (t.owner || 'nobody') + ', due ' + t.due_date + ')').join('\n') : '',
    recent.length ? 'Closed in the last two weeks:\n' + recent.slice(0, 6).map((t)=>'- ' + t.title + (t.owner ? ' (' + t.owner + ')' : '')).join('\n') : 'Nothing closed in the last two weeks.',
    open.filter((t)=>!t.due_date).length ? open.filter((t)=>!t.due_date).length + ' open tasks have no due date.' : ''];
  return lines.filter(Boolean).join('\n');
}

function rosterState(r) {
  const st = String(r.status || '').toLowerCase();
  if (st === 'cancelled') return 'off';
  if (st === 'confirmed' || r.confirm_status === 'confirmed') return 'yes';
  if (st === 'unavailable' || r.confirm_status === 'declined') return 'no';
  return 'waiting';
}
const ROLE_LABEL = { server: 'server', cook: 'cook', driver: 'driver', photographer: 'photographer', videographer: 'videographer', dishwasher: 'dishwasher', team_leader: 'team leader', community_debrief: 'community lead', community_talker: 'community lead', volunteer: 'volunteer' };
async function lookEvents(input, f, today) {
  const mtl = canPage(f, 'volunteering'), to = canPage(f, 'toronto') || mtl;
  if (!mtl && !to) return 'NOT ALLOWED: this person cannot open the Volunteer Manager. Say so and offer to ask for access.';
  let q = svc.from('volunteer_events').select('id,code,event_date,location,status,kind,title,planned_meals,start_time,spot_counts');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(input.date || '')) ? String(input.date) : '';
  if (date) q = q.eq('event_date', date); else q = q.gte('event_date', input.past === true ? new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10) : today);
  const { data: evs0 } = await q.order('event_date', { ascending: input.past !== true }).limit(30);
  const city = fold(input.city || '');
  let evs = (evs0 || []).filter((e)=>{
    const tor = /toronto/i.test(String(e.location || ''));
    if (tor ? !to : !mtl) return false;
    if (city && fold(e.location).indexOf(city) < 0 && !(city === 'montreal' && !tor)) return false;
    return true;
  });
  if (!evs.length) return 'No serving or event matches that' + (date ? ' on ' + date : '') + '.';
  const detail = date || evs.length === 1 || input.detail === true;
  evs = evs.slice(0, detail ? 2 : 6);
  const { data: ros } = await svc.from('event_roster').select('event_id,person_name,role,status,confirm_status').in('event_id', evs.map((e)=>e.id)).limit(600);
  const who = fold(input.person || '');
  const out = [];
  for (const e of evs) {
    const rs = (ros || []).filter((r)=>r.event_id === e.id && rosterState(r) !== 'off');
    const yes = rs.filter((r)=>rosterState(r) === 'yes'), no = rs.filter((r)=>rosterState(r) === 'no'), wait = rs.filter((r)=>rosterState(r) === 'waiting');
    const head = e.event_date + ' ' + (e.title || e.kind || 'serving') + ' in ' + (e.location || '?') + (e.start_time ? ' at ' + String(e.start_time).slice(0, 5) : '') + (e.status && e.status !== 'planned' ? ' [' + e.status + ']' : '') + ' (link: #volunteering/e/' + e.id + ')';
    const lines = ['EVENT ' + head, 'On the list: ' + rs.length + '. Confirmed: ' + yes.length + '. Waiting for an answer: ' + wait.length + '. Cannot make it: ' + no.length + '.' + (e.planned_meals ? ' Planned meals: ' + e.planned_meals + '.' : '')];
    const sc = e.spot_counts && typeof e.spot_counts === 'object' ? e.spot_counts : null;
    const roles = {};
    rs.forEach((r)=>{ const k = r.role || 'volunteer'; roles[k] = roles[k] || { yes: 0, all: 0 }; roles[k].all++; if (rosterState(r) === 'yes') roles[k].yes++; });
    const roleLine = Object.keys(Object.assign({}, roles, sc || {})).map((k)=>{
      const need = sc && Number(sc[k]) ? Number(sc[k]) : 0; const x = roles[k] || { yes: 0, all: 0 };
      if (!need && !x.all) return '';
      return (ROLE_LABEL[k] || k) + 's ' + x.yes + ' confirmed of ' + x.all + (need ? ' (spots: ' + need + (x.yes < need ? ', ' + (need - x.yes) + ' still to fill' : '') + ')' : '');
    }).filter(Boolean);
    if (roleLine.length) lines.push('By role: ' + roleLine.join('; ') + '.');
    if (detail || who) {
      const nm = (r)=>String(r.person_name || 'someone').trim() + ' (' + (ROLE_LABEL[r.role] || r.role || 'volunteer') + ')';
      const pick = (arr)=>who ? arr.filter((r)=>fold(r.person_name).indexOf(who) >= 0) : arr;
      if (pick(yes).length) lines.push('Confirmed: ' + pick(yes).slice(0, 45).map(nm).join(', '));
      if (pick(wait).length) lines.push('Waiting for an answer: ' + pick(wait).slice(0, 45).map(nm).join(', '));
      if (pick(no).length) lines.push('Cannot make it: ' + pick(no).slice(0, 30).map(nm).join(', '));
      if (who && !pick(rs).length) lines.push('Nobody named "' + input.person + '" is on this list.');
    }
    out.push(lines.join('\n'));
  }
  out.push('(Names and roles only: phone numbers and emails stay in the Volunteer Manager.)');
  return out.join('\n\n');
}

async function lookCrm(input, f) {
  const crm = canPage(f, 'crm');
  const partnersOk = canPage(f, 'partners');
  if (!crm && !partnersOk) return 'NOT ALLOWED: this person cannot open the CRM. Say so and offer to ask for access.';
  const name = String(input.name || '').trim();
  const ws = words(name);
  if (!ws.length) return 'Give a name, an organization or a company.';
  const out = [];
  if (partnersOk) {
    try {
      const { data: ps0 } = await svc.from('wa_partners').select('id,name,aka,kind,city,relationship,status,category,summary,visibility,first_year,last_year,notes').or(likeAny('name', ws)).limit(6);
      const ps = (ps0 || []).filter((p)=>(f.leader === true || f.board_viewer === true || p.visibility === 'everyone') && !confHit(p.name)).slice(0, 3);
      for (const p of ps) {
        const lines = ['ORGANIZATION: ' + p.name + ' (link: #partners/' + p.id + '): ' + [p.category, p.status, p.kind, p.city, p.first_year ? (p.first_year + (p.last_year && p.last_year !== p.first_year ? ' to ' + p.last_year : '')) : ''].filter(Boolean).join(', ') + '.'];
        if (p.relationship) lines.push('Relationship: ' + String(p.relationship).slice(0, 200));
        if (p.summary) lines.push('Summary: ' + String(p.summary).slice(0, 500));
        if (crm) {
          try {
            const { data: links } = await svc.from('crm_contact_orgs').select('contact_id,role_title').eq('partner_id', p.id).limit(12);
            if ((links || []).length) {
              const { data: cs } = await svc.from('crm_contacts').select('id,full_name').in('id', links.map((l)=>l.contact_id));
              lines.push('People there in the CRM: ' + (cs || []).map((c)=>{ const l = links.find((x)=>x.contact_id === c.id); return c.full_name + (l && l.role_title ? ' (' + l.role_title + ')' : ''); }).join(', '));
            }
          } catch (_) {}
        }
        out.push(lines.join('\n'));
      }
    } catch (_) {}
  }
  if (crm) {
    const { data: cs0 } = await svc.from('crm_contacts').select('id,full_name,kinds,tags,organization,job_title,city,language,do_not_contact,email_consent,last_activity_at,merged_into,notes').is('merged_into', null).or(likeAny('full_name', ws) + ',' + likeAny('organization', ws)).limit(20);
    let cs = (cs0 || []).filter((c)=>!confHit(c.full_name));
    const full = fold(name);
    cs.sort((a, b)=>(fold(b.full_name) === full ? 1 : 0) - (fold(a.full_name) === full ? 1 : 0) || String(b.last_activity_at || '').localeCompare(String(a.last_activity_at || '')));
    if (cs.length > 3 && fold(cs[0].full_name) !== full) {
      out.push('PEOPLE MATCHING (' + cs.length + '; ask which one): ' + cs.slice(0, 10).map((c)=>c.full_name + (c.organization ? ' (' + c.organization + ')' : '') + ' [' + (c.kinds || []).join(', ') + ']').join('; '));
    } else {
      for (const c of cs.slice(0, 2)) {
        const lines = ['CONTACT: ' + c.full_name + ' (link: #crm/c/' + c.id + '): ' + [(c.kinds || []).join(', '), c.job_title, c.organization, c.city].filter(Boolean).join(', ') + '.' + (c.do_not_contact ? ' DO NOT CONTACT: say so first.' : '') + (c.last_activity_at ? ' Last activity: ' + String(c.last_activity_at).slice(0, 10) + '.' : '')];
        if ((c.tags || []).length) lines.push('Tags: ' + c.tags.slice(0, 10).join(', '));
        if (c.notes) lines.push('Notes: ' + String(c.notes).slice(0, 400));
        try {
          const { data: gs } = await svc.from('crm_donations').select('amount,currency,donated_at,campaign,recurring,refunded_amount').eq('contact_id', c.id).order('donated_at', { ascending: false }).limit(50);
          if ((gs || []).length) {
            const tot = gs.reduce((a, g)=>a + Number(g.amount || 0) - Number(g.refunded_amount || 0), 0);
            lines.push('Gifts: ' + gs.length + ', $' + tot.toFixed(2) + ' in all. Latest: ' + gs.slice(0, 4).map((g)=>'$' + Number(g.amount || 0).toFixed(2) + ' on ' + String(g.donated_at || '').slice(0, 10) + (g.campaign ? ' (' + g.campaign + ')' : '') + (g.recurring ? ' monthly' : '')).join('; '));
          }
        } catch (_) {}
        try {
          const { data: is } = await svc.from('crm_interactions').select('kind,direction,channel,subject,body,occurred_at,source').eq('contact_id', c.id).order('occurred_at', { ascending: false }).limit(10);
          if ((is || []).length) lines.push('History, newest first:\n' + is.map((i)=>'- ' + String(i.occurred_at || '').slice(0, 10) + ' ' + [i.kind, i.direction === 'out' ? 'we sent' : i.direction === 'in' ? 'they sent' : ''].filter(Boolean).join(', ') + (i.subject ? ': ' + String(i.subject).slice(0, 120) : '') + (i.body ? ' | ' + String(i.body).replace(/<[^>]+>/g, ' ').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]').replace(/\s+/g, ' ').slice(0, 220) : '')).join('\n'));
        } catch (_) {}
        out.push(lines.join('\n'));
      }
    }
  }
  if (!out.length) return 'Nobody and no organization in the CRM matches "' + name + '".' + (crm ? '' : ' (This person can see Partners but not the CRM\'s contacts.)');
  out.push('(Phone numbers, emails and addresses stay in the CRM; link the contact instead.)');
  return out.join('\n\n');
}

let TOURS_CACHE = null;
async function lookGuide(input, f) {
  if (!TOURS_CACHE) {
    try { const { data } = await svc.from('trainings').select('key,title,description,body').eq('kind', 'tour').eq('active', true).limit(120); TOURS_CACHE = data || []; } catch (_) { TOURS_CACHE = []; }
  }
  const ws = words(input.topic);
  const open = Object.keys(PAGE_LABEL).filter((k)=>canPage(f, k));
  const shut = Object.keys(PAGE_LABEL).filter((k)=>f && f.staff === true && f.pages && f.pages[k] === false);
  const fit = (s)=>{ const l = fold(s); return ws.filter((w)=>l.indexOf(w) >= 0).length; };
  const tours = (TOURS_CACHE || []).map((t)=>({ t, s: fit(t.title + ' ' + t.description) })).filter((x)=>!ws.length || x.s > 0).sort((a, b)=>b.s - a.s).slice(0, ws.length ? 5 : 0);
  const pages = Object.keys(PAGE_LABEL).map((k)=>({ k, s: fit(PAGE_LABEL[k] + ' ' + k) })).filter((x)=>x.s > 0).slice(0, 5);
  const lines = [];
  const seen = {};
  const line = (k, extra)=>{ if (seen[k]) return; seen[k] = 1; lines.push('- ' + (PAGE_LABEL[k] || k) + ' (link: #' + k + '): ' + (canPage(f, k) ? 'they can open it' : 'NOT in their access: they can ask for it (propose request_access)') + (extra ? '. ' + extra : '')); };
  pages.forEach((x)=>line(x.k));
  tours.forEach((x)=>{ const tab = x.t.body && x.t.body.tab; if (tab && PAGE_LABEL[tab]) line(tab, x.t.description); else lines.push('- ' + x.t.title.replace(/^Page tour: /, '') + ': ' + x.t.description); });
  if (!lines.length) lines.push('Nothing named that. The pages they can open: ' + open.map((k)=>PAGE_LABEL[k]).join(', ') + '.');
  else if (!ws.length) lines.push('Pages they can open: ' + open.map((k)=>PAGE_LABEL[k]).join(', ') + '.');
  if (shut.length && !ws.length) lines.push('Pages outside their access: ' + shut.map((k)=>PAGE_LABEL[k]).join(', ') + '.');
  lines.push('Every page has a page tour in the [Avenue Academy](#training); pages stay locked until their tour is done (admins excepted).');
  return 'THE HUB, FOR THIS PERSON:\n' + lines.join('\n');
}

const LOOKUP_TOOLS = [
  { name: 'look_up_request', description: 'Read one request in full: its type, team, status and the steps it moves through, who filed it and who handles it, what the form says and its notes. Use for "what is request 19 about", "where is my poster request", "what did they ask for".', input_schema: { type: 'object', properties: { request_id: { type: 'integer' }, search: { type: 'string', description: 'A few words from its title when there is no number.' } } } },
  { name: 'look_up_task', description: 'Read one open task in full: description, owner, due date, project, subtasks and the latest comments. Use before helping someone finish or plan a task.', input_schema: { type: 'object', properties: { task_id: { type: 'integer' }, search: { type: 'string' } } } },
  { name: 'project_report', description: 'A progress report on one project: tasks done and open, percent done, what is past its date, what is coming, who holds the open work, what closed lately. Leave project empty for the list of projects.', input_schema: { type: 'object', properties: { project: { type: 'string', description: 'The project name as the person said it.' } } } },
  { name: 'volunteer_events', description: 'The servings and volunteer events, with who is confirmed, who has not answered and who cannot make it, by role and against the spots needed. Upcoming by default; give a date (YYYY-MM-DD) for one event, a city, a person\'s name, or past: true for the last two months.', input_schema: { type: 'object', properties: { date: { type: 'string' }, city: { type: 'string' }, person: { type: 'string' }, past: { type: 'boolean' }, detail: { type: 'boolean', description: 'true to list the names for every event shown.' } } } },
  { name: 'crm_lookup', description: 'Look up a person, donor, supporter, company or organization in the CRM: who they are to us, their history with us (emails, forms, messages), their gifts, and the people at an organization.', input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'hub_guide', description: 'Where something is in the Hub and how it works: the page, its link, what it is for, and whether this person can open it. Use for "where do I...", "how do I...", "what can the Hub do".', input_schema: { type: 'object', properties: { topic: { type: 'string' } } } }
];
async function runLookup(name, input, f, today) {
  try {
    if (name === 'look_up_request') return LOOKUP_DONE(await lookRequest(input || {}, f));
    if (name === 'look_up_task') return LOOKUP_DONE(await lookTask(input || {}, f));
    if (name === 'project_report') return LOOKUP_DONE(await lookProject(input || {}, f, today));
    if (name === 'volunteer_events') return LOOKUP_DONE(await lookEvents(input || {}, f, today));
    if (name === 'crm_lookup') return LOOKUP_DONE(await lookCrm(input || {}, f));
    if (name === 'hub_guide') return LOOKUP_DONE(await lookGuide(input || {}, f));
  } catch (e) { return 'The look-up failed: ' + String(e).slice(0, 120); }
  return 'Unknown look-up.';
}

/* ---------- v17 (wave324): more actions, each behind a Confirm card ----------
   send_slack_message: Steel (12/11/26) chose "From WA HUB, after Confirm": a direct message from the WA HUB app that names who
   asked, to people on the team list only, sent only after the card shows the exact words and they press Confirm. Ten a day per
   person. The words are never stored by the Hub (change_log keeps who to whom). update_task and add_subtasks help people move
   their own work along; request_access files the same access request the Hub's own Request access button files. */
const SEND_SLACK_TOOL = { name: 'send_slack_message', description: 'PROPOSE a Slack direct message from the WA HUB app to one person on the team list, ONLY when the latest user message asks to message, tell, ping or remind someone. The message says who asked. Write the words the user wants sent, in their voice, short and plain; never add facts they did not give. The user sees the exact words and confirms before it goes.', input_schema: { type: 'object', properties: { to: { type: 'string', description: 'The person\'s name from TEAM MEMBERS.' }, message: { type: 'string', description: 'The exact words to send, at most 600 characters.' } }, required: ['to', 'message'] } };
const UPDATE_TASK_TOOL = { name: 'update_task', description: 'PROPOSE changing one open task: a new due date, a new owner, or a note added to its comments. ONLY when the latest user message asks. task_id from a task list or look_up_task.', input_schema: { type: 'object', properties: { task_id: { type: 'integer' }, title: { type: 'string', description: 'The task title, copied.' }, due_date: { type: 'string', description: 'YYYY-MM-DD' }, owner: { type: 'string', description: 'A name from TEAM MEMBERS.' }, note: { type: 'string', description: 'A comment to add, in the user\'s words.' } }, required: ['task_id'] } };
const ADD_SUBTASKS_TOOL = { name: 'add_subtasks', description: 'PROPOSE breaking one open task into smaller steps (subtasks), when the user asks for help getting a task done and agrees to the steps, or asks to add steps. At most 8 short, startable steps.', input_schema: { type: 'object', properties: { task_id: { type: 'integer' }, title: { type: 'string', description: 'The parent task title, copied.' }, steps: { type: 'array', items: { type: 'string' } } }, required: ['task_id', 'steps'] } };
const REQUEST_ACCESS_TOOL = { name: 'request_access', description: 'PROPOSE asking the admins for access to one Hub page this person cannot open yet (hub_guide says which). ONLY when they ask for it or agree to it.', input_schema: { type: 'object', properties: { page: { type: 'string', description: 'The page key, for example crm or volunteering.' }, reason: { type: 'string', description: 'One line, from what they said.' } }, required: ['page'] } };
const MORE_ACTION_TOOLS = [SEND_SLACK_TOOL, UPDATE_TASK_TOOL, ADD_SUBTASKS_TOOL, REQUEST_ACCESS_TOOL];
const SLACK_DAILY = 10;

async function rosterPeople() {
  const { data } = await svc.from('team_members').select('id,name,email,department,active').eq('active', true);
  return (data || []).filter((m)=>m.active === true && m.name && /@welfareavenue\.com$/i.test(String(m.email || '').trim()));
}
/* one person on the team list from a name as typed: the full name, else a unique first name */
async function personNamed(name) {
  const n = fold(name).replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!n) return { error: 'say who it is for' };
  const ppl = await rosterPeople();
  let hit = ppl.filter((m)=>fold(m.name).replace(/\s+/g, ' ').trim() === n);
  if (!hit.length) hit = ppl.filter((m)=>fold(m.name).split(/\s+/)[0] === n.split(' ')[0] && (n.split(' ').length === 1 || fold(m.name).indexOf(n.split(' ').slice(-1)[0]) >= 0));
  if (hit.length === 1) return { person: hit[0] };
  if (hit.length > 1) return { error: 'more than one person is called ' + name + ': ' + hit.map((m)=>m.name).join(', ') };
  return { error: name + ' is not on the team list with a Welfare Avenue account' };
}
async function openTask(id) {
  const tid = Number(id);
  if (!Number.isInteger(tid) || tid <= 0) return { error: 'invalid task_id' };
  const { data: t } = await svc.from('dept_tasks').select('*').eq('id', tid).maybeSingle();
  if (!t || !taskOpenOk(t)) return { error: 'task not found' };
  if (t.done === true) return { error: 'that task is already closed' };
  return { task: t };
}
/* checked when the model proposes, so the card names real people and real tasks; checked again when it runs */
async function checkProposal(name, input, f) {
  const i = Object.assign({}, input || {});
  if (name === 'send_slack_message') {
    const msg = String(i.message || '').trim();
    if (!msg) return { error: 'the message is empty' };
    if (msg.length > 600) return { error: 'keep the message under 600 characters' };
    if (confHit(msg)) return { error: 'that message touches a topic the Hub does not carry; they can send it themselves' };
    const p = await personNamed(i.to);
    if (p.error) return { error: p.error };
    i.to = p.person.name; i.message = msg;
    return { input: i };
  }
  if (name === 'update_task' || name === 'add_subtasks') {
    const o = await openTask(i.task_id);
    if (o.error) return { error: o.error };
    i.title = o.task.title;
    if (name === 'update_task') {
      if (i.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(i.due_date))) return { error: 'the due date must be YYYY-MM-DD' };
      if (i.owner) { const p = await personNamed(i.owner); if (p.error) return { error: p.error }; i.owner = p.person.name; }
      if (i.note && confHit(i.note)) return { error: 'that note touches a topic the Hub does not carry' };
      if (!i.due_date && !i.owner && !String(i.note || '').trim()) return { error: 'nothing to change' };
    } else {
      const steps = (Array.isArray(i.steps) ? i.steps : []).map((s)=>String(s || '').trim().slice(0, 200)).filter((s)=>s && !confHit(s)).slice(0, 8);
      if (!steps.length) return { error: 'no steps given' };
      i.steps = steps;
    }
    return { input: i };
  }
  if (name === 'request_access') {
    const k = String(i.page || '').toLowerCase().replace(/^#/, '').trim();
    if (!PAGE_LABEL[k]) return { error: 'unknown page ' + i.page };
    if (canPage(f, k)) return { error: 'they can already open ' + PAGE_LABEL[k] };
    i.page = k;
    return { input: i };
  }
  return { input: i };
}
async function doSendSlack(input, rq) {
  const email = String((rq && rq.email) || '');
  const me = await askerOf(email);
  if (!me) return { error: 'only someone on the team list can send a message through the Hub' };
  const chk = await checkProposal('send_slack_message', input, null);
  if (chk.error) return { error: chk.error };
  const p = await personNamed(chk.input.to);
  if (p.error) return { error: p.error };
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await svc.from('change_log').select('id', { count: 'exact', head: true }).eq('entity_type', 'ask_slack_message').eq('field', 'sent').ilike('changed_by', '%' + email + '%').gte('changed_at', since);
  if ((count || 0) >= SLACK_DAILY) return { error: 'that is ' + SLACK_DAILY + ' messages through the Hub today; send this one yourself' };
  const token = await getSecret('SLACK_BOT_TOKEN');
  if (!token) return { error: 'the Hub is not connected to Slack' };
  const toEmail = String(p.person.email).trim().toLowerCase();
  let sid = '';
  try { const { data } = await svc.from('wa_slack_ids').select('slack_id').eq('email', toEmail).maybeSingle(); sid = (data && data.slack_id) || ''; } catch (_) {}
  const api = (Deno.env.get('SLACK_API_BASE') || 'https://slack.com/api');
  const call = async (method, body)=>{ const r = await fetch(api + '/' + method, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) }); return await r.json().catch(()=>({ ok: false })); };
  if (!sid) {
    try { const r = await fetch(api + '/users.lookupByEmail?email=' + encodeURIComponent(toEmail), { headers: { Authorization: 'Bearer ' + token } }); const b = await r.json(); if (b && b.ok && b.user && b.user.id) sid = b.user.id; } catch (_) {}
  }
  if (!sid) return { error: 'I could not find ' + p.person.name + ' on Slack' };
  const first = me.name.split(/\s+/)[0];
  const quoted = chk.input.message.replace(/[<>]/g, '').split('\n').map((l)=>'>' + (l ? ' ' + l : '')).join('\n');
  const text = '*' + me.name + '* asked me to pass this on:\n' + quoted + '\n_Sent by the Hub for ' + first + '. Reply to ' + first + ' directly._';
  const open = await call('conversations.open', { users: sid });
  if (!open || !open.ok || !open.channel) return { error: 'Slack would not open a conversation with ' + p.person.name };
  const post = await call('chat.postMessage', { channel: open.channel.id, text, unfurl_links: false, unfurl_media: false });
  if (!post || !post.ok) return { error: 'Slack did not take the message (' + String((post && post.error) || 'unknown') + ')' };
  await svc.from('change_log').insert({ entity_type: 'ask_slack_message', entity_id: toEmail, field: 'sent', old_value: null, new_value: 'to ' + p.person.name, changed_by: 'Chat (' + email + (rq && rq.via ? ' via ' + rq.via : '') + ')' });
  return { ok: true, detail: 'Sent to ' + p.person.name + ' on Slack, from WA HUB with your name on it.' };
}
async function doUpdateTask(input, rq) {
  const me = await askerOf(String((rq && rq.email) || ''));
  const chk = await checkProposal('update_task', input, null);
  if (chk.error) return { error: chk.error };
  const i = chk.input, o = await openTask(i.task_id), t = o.task;
  const by = 'Chat (' + ((rq && rq.who) || 'someone') + ((rq && rq.via) ? ' via ' + rq.via : '') + ')';
  const patch = {}, done = [];
  if (i.due_date && i.due_date !== t.due_date) { patch.due_date = i.due_date; done.push('due ' + i.due_date); }
  if (i.owner && i.owner !== t.owner) { patch.owner = i.owner; done.push('owner ' + i.owner); }
  if (Object.keys(patch).length) {
    patch.updated_at = new Date().toISOString(); patch.updated_by = by;
    const { error } = await svc.from('dept_tasks').update(patch).eq('id', t.id).eq('done', false);
    if (error) return { error: 'update failed: ' + error.message };
    for (const k of Object.keys(patch)) { if (k === 'updated_at' || k === 'updated_by') continue; await svc.from('change_log').insert({ entity_type: 'task', entity_id: String(t.id), field: k, old_value: t[k] == null ? null : String(t[k]), new_value: String(patch[k]), changed_by: by }); }
  }
  const note = String(i.note || '').trim().slice(0, 800);
  if (note) {
    const { error } = await svc.from('task_comments').insert({ task_id: t.id, body: note, author: (me && me.name) || by, source: 'ask' });
    if (error) return { error: 'the note could not be saved: ' + error.message };
    done.push('a note added');
  }
  return { ok: true, detail: 'Updated "' + t.title + '": ' + (done.join(', ') || 'nothing needed changing') + '.' };
}
async function doAddSubtasks(input, rq) {
  const chk = await checkProposal('add_subtasks', input, null);
  if (chk.error) return { error: chk.error };
  const t = (await openTask(chk.input.task_id)).task;
  const by = 'Chat (' + ((rq && rq.who) || 'someone') + ((rq && rq.via) ? ' via ' + rq.via : '') + ')';
  const now = new Date().toISOString();
  const rows = chk.input.steps.map((s)=>({ department: t.department, subsection: t.subsection || null, title: s, owner: t.owner || null, status: 'Open', flag: false, priority: false, done: false, sort: 999, due_date: null, project_id: t.project_id || null, parent_task_id: t.id, updated_by: by, opened_at: now, updated_at: now, visibility: t.visibility || null }));
  const { error } = await svc.from('dept_tasks').insert(rows);
  if (error) return { error: 'could not add the steps: ' + error.message };
  await svc.from('change_log').insert({ entity_type: 'task', entity_id: String(t.id), field: 'subtasks', old_value: null, new_value: rows.length + ' added from the chat', changed_by: by });
  return { ok: true, detail: 'Added ' + rows.length + ' step' + (rows.length === 1 ? '' : 's') + ' under "' + t.title + '".' };
}
async function doRequestAccess(input, rq) {
  const email = String((rq && rq.email) || '');
  const me = await askerOf(email);
  if (!me) return { error: 'only someone on the team list can ask for access here' };
  const f = await accessFacts(email);
  const chk = await checkProposal('request_access', input, f);
  if (chk.error) return { error: chk.error };
  const k = chk.input.page;
  const { data: open } = await svc.from('wa_access_requests').select('id').eq('email', email).eq('wanted', 'tab:' + k).eq('status', 'new').limit(1);
  if ((open || []).length) return { ok: true, detail: 'Already asked: ' + PAGE_LABEL[k] + ' is waiting for an admin.' };
  const reason = String(chk.input.reason || '').trim().slice(0, 240);
  const { error } = await svc.from('wa_access_requests').insert({ email, name: me.name, role_now: f.role || 'member', wanted: 'tab:' + k, reason: reason ? 'Asked Ask the Hub: ' + reason : 'From Ask the Hub', status: 'new' });
  if (error) return { error: 'could not file it: ' + error.message };
  try {
    const secret = await getSecret('WA_TRIGGER_SECRET');
    if (secret) await fetch(SUPABASE_URL + '/functions/v1/notify', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-wa-secret': String(secret) }, body: JSON.stringify({ event: 'change_request_text', text: ':key: Access request from ' + me.name + ': tab:' + k + ' (' + PAGE_LABEL[k] + '), from Ask the Hub. Review in Admin > Access requests.' }) });
  } catch (_) {}
  return { ok: true, detail: 'Asked the admins for ' + PAGE_LABEL[k] + '. You will see it the next time you open the Hub once it is granted.' };
}

/* v16: what belongs to one request travels with it as rq = { auth, who, via }, never in a shared variable. Two people asking at
   the same moment used to share ASK_AUTH and ASK_WHO, so one person's sign-in could have been used for the other's meeting
   search. auth: the asker's own Authorization header ('' on the trusted path), for what runs as them (wa_ask_meetings,
   bank_task). who: the email's first part, for the usage log. via: 'slack' on the trusted path, '' for the Hub's own chat. */
async function anthropicCall(key, messages, tools, toolChoice, rq) {
  let lastErr = '';
  for (const model of MODELS){
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'x-wa-task': 'brain',
        'x-wa-caller': 'ask' + (rq && rq.who ? ':' + rq.who : ''),
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
async function callModel(key, orKey, messages, tools, toolChoice, rq) {
  if (key) {
    try {
      return await anthropicCall(key, messages, tools, toolChoice, rq);
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
  if (name === 'send_slack_message') return 'Send ' + input.to + ' a Slack message from WA HUB, with your name on it: "' + String(input.message || '') + '"';
  if (name === 'update_task') return 'Update "' + (input.title || 'task #' + input.task_id) + '"' + [input.due_date ? ' due ' + input.due_date : '', input.owner ? ' owner ' + input.owner : '', input.note ? ' add the note: "' + input.note + '"' : ''].filter(Boolean).join(',');
  if (name === 'add_subtasks') return 'Add ' + (input.steps || []).length + ' steps under "' + (input.title || 'task #' + input.task_id) + '": ' + (input.steps || []).map((x, n)=>(n + 1) + '. ' + x).join(' ');
  if (name === 'request_access') return 'Ask the admins for access to ' + (PAGE_LABEL[input.page] || input.page) + (input.reason ? ' (' + input.reason + ')' : '');
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
async function doBankTask(input, rq) {
  const ASK_AUTH = String((rq && rq.auth) || '');
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
async function execAction(name, input, caller, isBoard, rq) {
  try {
    if (name === 'close_task') return await doCloseTask(input, caller, isBoard);
    if (name === 'bank_task') return await doBankTask(input, rq);
    if (name === 'complete_request') return await doCompleteRequest(input, caller);
    if (name === 'set_request_status') return await doSetRequestStatus(input, caller);
    if (name === 'create_request') return await doCreateRequest(input, caller);
    if (name === 'create_task') return await doCreateTask(input, caller);
    if (name === 'send_slack_message') return await doSendSlack(input, rq);
    if (name === 'update_task') return await doUpdateTask(input, rq);
    if (name === 'add_subtasks') return await doAddSubtasks(input, rq);
    if (name === 'request_access') return await doRequestAccess(input, rq);
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
async function runAgent(history, context, question, rq, facts) {
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
  /* v16: banking runs as the signed-in person, so it is not offered where there is no sign-in of theirs (Slack).
     v17: the look-ups only for someone the Hub counts as staff; Slack messages and access requests only for a named person */
  const staff = !!(facts && facts.staff === true);
  const named = !!(rq && rq.email);
  const allTools = [
    ANSWER_TOOL,
    ...(staff ? LOOKUP_TOOLS : []),
    ...ACTION_TOOLS.filter((t)=>!(rq && rq.via && t.name === 'bank_task')),
    ...MORE_ACTION_TOOLS.filter((t)=>named && (staff || t.name === 'request_access'))
  ];
  const lookupNames = LOOKUP_TOOLS.map((t)=>t.name);
  const today = torontoToday().iso;
  const proposals = [];
  let lookups = 0;
  for(let round = 0; round < 4; round++){
    const body = await callModel(key, orKey, messages, allTools, { type: 'auto' }, rq);
    const content = body.content || [];
    const others = content.filter((c)=>c.type === 'tool_use' && c.name !== 'answer_question');
    if (!others.length) {
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
        results.push({ type: 'tool_result', tool_use_id: block.id, content: 'Noted. Give the final answer again once you have what you need.' });
        continue;
      }
      if (lookupNames.indexOf(block.name) >= 0) {
        if (!staff || lookups >= 6) {
          results.push({ type: 'tool_result', tool_use_id: block.id, content: staff ? 'Look-up limit reached for this question: answer with what you have.' : 'NOT ALLOWED.', is_error: true });
          continue;
        }
        lookups++;
        results.push({ type: 'tool_result', tool_use_id: block.id, content: await runLookup(String(block.name), block.input || {}, facts, today) || 'Nothing found.' });
        continue;
      }
      if (proposals.length >= 4) {
        results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ error: 'proposal limit reached for this message' }), is_error: true });
        continue;
      }
      let input = block.input || {};
      if (MORE_ACTION_TOOLS.some((t)=>t.name === block.name)) {
        const chk = await checkProposal(String(block.name), input, facts);
        if (chk.error) {
          results.push({ type: 'tool_result', tool_use_id: block.id, content: 'Not proposed: ' + chk.error + '. Tell the user plainly.', is_error: true });
          continue;
        }
        input = chk.input;
      }
      proposals.push({
        name: String(block.name),
        input,
        summary: summarize(String(block.name), input)
      });
      results.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: 'Captured as a pending action. The user will see a confirmation card and it only runs if they confirm. Do not describe it as done; tell them it is ready to confirm below.'
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
  }, rq);
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
/* v16: who is asking, what day it is, and what is on their plate. Everything here follows the rules of the other task blocks:
   nothing banked, board-only, confidential, restricted or from the Board team, and no title that touches an off-limits topic. */
function torontoToday() {
  const now = new Date();
  let iso = '', long = '';
  try { iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); } catch (_) { iso = now.toISOString().slice(0, 10); }
  try { long = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Toronto', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now); } catch (_) { long = iso; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) iso = now.toISOString().slice(0, 10);
  return { iso, long };
}
function firstWord(name) { return String(name || '').trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z\u00c0-\u024f-]/g, ''); }
function ownerHas(owner, first) {
  if (!first) return false;
  return (' ' + String(owner || '').toLowerCase().replace(/[^a-z0-9\u00c0-\u024f-]+/g, ' ') + ' ').indexOf(' ' + first + ' ') >= 0;
}
function dayGap(a, b) { return Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000); }
async function askerOf(email) {
  if (!email) return null;
  try {
    const { data } = await svc.from('team_members').select('id, name, email, department, active').eq('active', true);
    const m = (data || []).find((r)=>r.active === true && String(r.email || '').trim().toLowerCase() === email);
    return m && m.name ? { id: m.id, name: String(m.name).trim(), department: m.department || '' } : null;
  } catch (_) { return null; }
}
async function askerBlock(asker, via) {
  const today = torontoToday();
  const lines = [];
  if (via === 'slack') lines.push('ASKED FROM SLACK: the answer is read in Slack. Moving a task to the bank is not available from Slack; if they ask for that, say it takes one tap in the Hub: [The bank](#bank).');
  if (!asker) return lines.concat(['TODAY IS ' + today.long + ' (' + today.iso + ').', 'WHO IS ASKING: not on the team list, so nothing here says which tasks are theirs.']).join('\n');
  const team = DEPT_LABELS[asker.department] || '';
  lines.push('WHO IS ASKING: ' + asker.name + (team && asker.department !== 'board' ? ' (' + team + ')' : '') + '. "I", "me" and "my" in the question mean ' + asker.name.split(/\s+/)[0] + '.');
  lines.push('TODAY IS ' + today.long + ' (' + today.iso + ').');
  try {
    const first = firstWord(asker.name);
    const [{ data: rows }, { data: links }] = await Promise.all([
      svc.from('dept_tasks').select('id,department,title,owner,due_date,flag,done,banked_at,board_only,confidential,visibility,owner_unsure').is('banked_at', null).eq('done', false).or(OPEN_VIS).eq('board_only', false).not('confidential', 'is', true).neq('department', 'board').limit(1000),
      svc.from('task_assignees').select('task_id').eq('member_id', asker.id)
    ]);
    const assigned = new Set((links || []).map((l)=>Number(l.task_id)));
    const mine = (rows || []).filter((t)=>{
      /* the same rules again here, so a wider query can never widen what is shown */
      if (t.done === true || t.banked_at || t.board_only === true || t.confidential === true || t.department === 'board') return false;
      if (t.visibility && t.visibility !== 'department') return false;
      if (confHit(t.title)) return false;
      return (assigned.has(Number(t.id)) && t.owner_unsure !== true) || ownerHas(t.owner, first);
    });
    const rank = (t)=>t.due_date ? (t.due_date < today.iso ? 0 : 1) : 2;
    mine.sort((a, b)=>rank(a) - rank(b) || String(a.due_date || '').localeCompare(String(b.due_date || '')) || a.id - b.id);
    const late = mine.filter((t)=>t.due_date && t.due_date < today.iso).length;
    if (!mine.length) lines.push('THEIR OPEN TASKS: none under their name.');
    else {
      lines.push('THEIR OPEN TASKS (' + mine.length + ' open, ' + late + ' past the due date; numeric ids usable with close_task and bank_task):');
      mine.slice(0, 20).forEach((t)=>{
        let when = 'no due date';
        if (t.due_date) {
          const gap = dayGap(t.due_date, today.iso);
          when = gap < 0 ? 'due ' + t.due_date + ', OVERDUE by ' + (-gap) + (gap === -1 ? ' day' : ' days') : gap === 0 ? 'due TODAY' : 'due ' + t.due_date + ' (in ' + gap + (gap === 1 ? ' day' : ' days') + ')';
        }
        lines.push(t.id + '. ' + t.title + ' (' + (DEPT_LABELS[t.department] || t.department) + ', ' + when + (t.flag ? ', flagged' : '') + ')');
      });
      if (mine.length > 20) lines.push('... and ' + (mine.length - 20) + ' more on their Home page.');
    }
  } catch (_) {}
  try {
    const first = firstWord(asker.name);
    const { data: reqs0 } = await svc.from('dept_requests').select('id,title,department,status,type_key,assignee,created_at').eq('done', false).neq('type_key', 'time-off').neq('department', 'board').order('created_at', { ascending: true }).limit(200);
    const waiting = (reqs0 || []).filter((r)=>r.type_key !== 'time-off' && r.department !== 'board' && !confHit(r.title) && r.assignee && (String(r.assignee).trim().toLowerCase() === asker.name.toLowerCase() || ownerHas(r.assignee, first)));
    if (waiting.length) {
      lines.push('REQUESTS WAITING ON THEM (' + waiting.length + '; ids usable with complete_request and set_request_status):');
      waiting.slice(0, 10).forEach((r)=>lines.push(r.id + '. ' + (r.title || 'Untitled') + ' (' + (DEPT_LABELS[r.department] || r.department) + ', status: ' + (r.status || 'new') + ')'));
    }
  } catch (_) {}
  return lines.join('\n');
}
async function buildContext(question, isBoard, acc, asker, rq) {
  const ASK_AUTH = String((rq && rq.auth) || ''), ASK_WHO = String((rq && rq.who) || '');
  const kws = keywords(question);
  const parts = [];
  try { parts.push(await askerBlock(asker, (rq && rq.via) || '')); } catch (_) {}
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
        parts.push('OPEN TASKS MATCHING THE QUESTION (numeric ids usable with close_task and bank_task):\n' + matched.map((t)=>t.id + '. ' + t.title + ' (' + (DEPT_LABELS[t.department] || t.department) + ', owner: ' + (t.owner || 'unowned') + ', status: ' + (t.status || 'open') + (t.due_date ? ', due ' + t.due_date : '') + ')').join('\n'));
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
  /* v16: the trusted path carries the function's own key, not the person's sign-in: nothing may run "as them" with it */
  const rq = {
    auth: (auth && auth.via) ? '' : (req.headers.get('Authorization') || ''),
    who: (auth && auth.ok && auth.who) ? String(auth.who).toLowerCase().slice(0, 80) : '',
    via: (auth && auth.ok && auth.via) ? String(auth.via) : '',
    email: (auth && auth.ok && auth.email) ? String(auth.email).toLowerCase() : ''
  };
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
    const out = await execAction(name, input, auth.who + (auth.via ? ' via ' + auth.via : ''), isBoard, rq);
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
    const asker = await askerOf(auth.email);
    const context = await buildContext(question, isBoard, acc, asker, rq);
    const facts = await accessFacts(rq.email);
    const out = await runAgent(history, context || 'No matching data was found in the dashboard database for this question.', question, rq, facts);
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
