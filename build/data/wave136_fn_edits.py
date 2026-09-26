#!/usr/bin/env python3
"""wave136 (26/09/26): process-transcript v14, content ideas from marketing meetings.

A second pass reads the whole marketing meeting (in up to three 60,000-character pieces, where the board
pass reads the first 30,000) for post, reel and series ideas, each with an exact quote from the meeting;
an idea whose quote is not in the transcript is dropped. content_ideas_from_meeting() files them in the
Content calendar's Ideas (the far ones in the bank). The Slack line that already goes out after a meeting
counts them. A new action, {action: 'ideas', transcript_id, dry_run?}, runs only this pass (for meetings
uploaded before wave136); it posts nothing to Slack.
Run from the repo root: python3 build/data/wave136_fn_edits.py
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
P = os.path.join(ROOT, 'fn', 'process-transcript', 'index.ts')
s = open(P, encoding='utf-8').read()
problems = []


def rep(old, new, count=1):
    global s
    c = s.count(old)
    if c != count:
        problems.append('found %d (expected %d): %s' % (c, count, old[:80].replace('\n', ' ')))
        return
    s = s.replace(old, new)


HEAD = """// v14 (26/09/26): content ideas. For a Marketing meeting a second pass reads the whole transcript (up to three 60,000-character
// pieces) for ideas for posts, reels, carousels, stories and series, even when nobody has committed to making them yet. Each idea
// carries an exact quote; one whose quote is not in the transcript is dropped. content_ideas_from_meeting() files them in the Content
// calendar's Ideas with the meeting they came from (an idea for three months or more away waits in the bank until six weeks before
// its date). The Slack line counts them. {action: 'ideas', transcript_id, dry_run?} runs only this pass, for older meetings, and posts
// nothing. Board-only, leadership and private meetings give no ideas. Model route: content_ideas.
"""
rep("// v13 (26/09/26): the bank.", HEAD + "// v13 (26/09/26): the bank.")

IDEAS = r"""
/* ---- v14: content ideas from marketing meetings ---- */
const IDEAS_SYSTEM = `You read one Welfare Avenue marketing meeting and pull out the content ideas raised in it: ideas for social posts, reels, carousels, stories, series, campaigns or stories worth telling on Instagram, Facebook, LinkedIn or TikTok, even when nobody committed to making them yet. The Hub keeps them in the Content calendar's Ideas so good ideas are not lost.

Rules:
1. Never use em dashes. Plain, specific language.
2. Only ideas actually raised in this meeting (or this part of it). Every idea needs evidence: an exact quote of 6 to 25 words copied word for word from the transcript where the idea came up. No quote, no idea.
3. Content ideas only. Skip operational to-dos (fix the website, send the schedule, order supplies), meeting logistics, anything about a person's performance, pay or health, and ideas the meeting turned down.
4. Skip anything already listed in existing_ideas, even when worded differently. Merge near duplicates into one idea.
5. title: a short working title a teammate would recognise, 3 to 8 words (for example "Volunteer spotlight: Sunday cooks").
6. idea: 1 to 3 sentences: what the post or series is, the angle or hook, and what it needs (photos, an interview, a partner, a date).
7. format: post, reel, carousel, story, series or other. platforms: only the ones named in the meeting, else an empty list.
8. suggested_by: the roster name of the person who raised it when it is clear, else null. Otter garbles names; map a spoken name to a roster name only when confident.
9. campaign: the named campaign, event or fundraiser it belongs to, else null.
10. for_date: when the meeting ties the idea to a date, an event or a season, the ISO date it is for (resolve relative dates from the meeting date; a month or a season means its first day), else null.
11. At most 12 ideas. An empty list is a fine answer.`;

const IDEAS_TOOL = {
  name: 'save_content_ideas',
  description: 'Save the content ideas raised in this meeting to the Content calendar.',
  input_schema: {
    type: 'object',
    properties: {
      ideas: { type: 'array', items: { type: 'object', properties: {
        title: { type: 'string' },
        idea: { type: 'string', description: '1 to 3 sentences: what it is, the angle, what it needs. No em dashes.' },
        format: { type: 'string', enum: ['post', 'reel', 'carousel', 'story', 'series', 'other'] },
        platforms: { type: 'array', items: { type: 'string', enum: ['instagram', 'facebook', 'linkedin', 'tiktok'] } },
        suggested_by: { type: ['string', 'null'] },
        campaign: { type: ['string', 'null'] },
        for_date: { type: ['string', 'null'], description: 'ISO date the idea is for, or null.' },
        evidence: { type: 'string', description: 'An exact quote of 6 to 25 words from the transcript where the idea was raised.' } },
        required: ['title', 'idea', 'evidence'] } }
    },
    required: ['ideas']
  }
};

function normText(x: string): string { return String(x || '').toLowerCase().replace(/[^a-z0-9À-ɏ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
/* an idea stands only when four consecutive words of its quote are in the transcript */
function quoted(evidence: string, transcriptNorm: string): boolean {
  const w = normText(evidence).split(' ').filter(Boolean);
  if (w.length < 4) return false;
  for (let i = 0; i + 4 <= w.length; i++) { if (transcriptNorm.includes(' ' + w.slice(i, i + 4).join(' ') + ' ')) return true; }
  return false;
}

type Idea = { title: string; idea: string; format?: string; platforms?: string[]; suggested_by?: string | null; campaign?: string | null; for_date?: string | null; evidence: string };

async function ideasPass(tx: Record<string, unknown>, roster: string[]): Promise<{ ideas: Idea[]; dropped: number; pieces: number }> {
  const body = String(tx.body || '');
  const { data: existing } = await svc.from('content_posts').select('title').not('title', 'is', null).order('id', { ascending: false }).limit(150);
  const known: string[] = (existing || []).map((r: { title: string | null }) => String(r.title || '')).filter(Boolean);
  const size = 60000, overlap = 1500;
  const pieces: string[] = [];
  for (let at = 0; at < body.length && pieces.length < 3; at += size - overlap) pieces.push(body.slice(at, at + size));
  const tNorm = ' ' + normText(body) + ' ';
  const found: Idea[] = [];
  let dropped = 0;
  for (let i = 0; i < pieces.length; i++) {
    const context = {
      meeting_title: tx.title, meeting_date: tx.meeting_date,
      meeting_weekday: tx.meeting_date ? new Date(String(tx.meeting_date) + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long' }) : null,
      part: pieces.length > 1 ? 'part ' + (i + 1) + ' of ' + pieces.length + ' of the transcript' : 'the whole transcript',
      roster, existing_ideas: known.concat(found.map(f => f.title)).slice(0, 180)
    };
    const res = await fetch(SUPABASE_URL + '/functions/v1/llm', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + SERVICE_KEY, 'x-wa-task': 'content_ideas', 'x-wa-caller': 'process-transcript', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-5', max_tokens: 3000, temperature: 0.2, system: IDEAS_SYSTEM,
        messages: [{ role: 'user', content: 'CONTEXT (JSON):\n' + JSON.stringify(context) + '\n\nTRANSCRIPT' + (pieces.length > 1 ? ' (' + context.part + ')' : '') + ':\n' + pieces[i] }],
        tools: [IDEAS_TOOL], tool_choice: { type: 'tool', name: 'save_content_ideas' }
      })
    });
    if (!res.ok) throw new Error('ideas pass failed: ' + res.status + ' ' + (await res.text()).slice(0, 200));
    const out = await res.json();
    const tu = (out.content || []).find((c: { type: string }) => c.type === 'tool_use');
    const list = (tu && tu.input && Array.isArray(tu.input.ideas)) ? tu.input.ideas as Idea[] : [];
    for (const it of list) {
      if (!it || !it.title || !it.idea) continue;
      if (!quoted(String(it.evidence || ''), tNorm)) { dropped++; continue; }
      const k = normText(it.title);
      if (found.some(f => normText(f.title) === k)) continue;
      found.push(it);
    }
  }
  return { ideas: found.slice(0, 15), dropped, pieces: pieces.length };
}

function ideasAllowed(tx: Record<string, unknown>): boolean {
  return tx.board_only !== true && ['leadership', 'private'].indexOf(String(tx.visibility || '')) < 0;
}

async function saveIdeas(transcriptId: number, ideas: Idea[], by: string): Promise<{ added: number; banked: number; skipped: number }> {
  if (!ideas.length) return { added: 0, banked: 0, skipped: 0 };
  const { data, error } = await svc.rpc('content_ideas_from_meeting', { p_transcript_id: transcriptId, p_ideas: ideas, p_by: by });
  if (error) throw new Error('saving ideas failed: ' + error.message);
  const d = (data || {}) as Record<string, number>;
  return { added: Number(d.added || 0), banked: Number(d.banked || 0), skipped: Number(d.skipped || 0) };
}

/* {action: 'ideas'}: only the ideas pass, for a marketing meeting uploaded before v14; no Slack */
async function ideasOnly(transcriptId: number, dryRun: boolean) {
  const { data: tx, error } = await svc.from('transcripts').select('*').eq('id', transcriptId).single();
  if (error || !tx) throw new Error('transcript not found');
  if (deptKey(tx.department) !== 'marketing') throw new Error('content ideas come from Marketing meetings only');
  if (!ideasAllowed(tx)) return { transcript_id: transcriptId, added: 0, reason: 'restricted meeting' };
  const { data: team } = await svc.from('team_members').select('name').eq('department', 'marketing').eq('active', true);
  const roster = [...new Set([...(team || []).map((m: { name: string }) => m.name), 'Steel MacDonald', 'Suhaib'])];
  const pass = await ideasPass(tx, roster);
  if (dryRun) return { transcript_id: transcriptId, dry_run: true, ideas: pass.ideas, dropped_without_quote: pass.dropped, pieces: pass.pieces };
  const saved = await saveIdeas(transcriptId, pass.ideas, 'AI: ' + (tx.title || 'transcript ' + transcriptId));
  return { transcript_id: transcriptId, ...saved, dropped_without_quote: pass.dropped, pieces: pass.pieces };
}
"""
rep("async function processTranscript(transcriptId: number, dryRun = false) {", IDEAS + "\nasync function processTranscript(transcriptId: number, dryRun = false) {")

# run the pass after the board update, before the Slack line
rep("""  // v6: count how many of this run's kept tasks landed in projects.
  const projectedCount""", """  // v14: content ideas from a marketing meeting go to the Content calendar (never blocks the run)
  let ideasRes: { added: number; banked: number; skipped: number; dropped?: number } | null = null;
  if (dept === 'marketing' && !effectiveBoardOnly && ideasAllowed(tx)) {
    try {
      const pass = await ideasPass(tx, rosterNames);
      const saved = await saveIdeas(transcriptId, pass.ideas, changedBy);
      ideasRes = { ...saved, dropped: pass.dropped };
    } catch (e) { console.error('content ideas pass failed', e); }
  }

  // v6: count how many of this run's kept tasks landed in projects.
  const projectedCount""")
rep("""  if (r.decisions_decided) parts.push(r.decisions_decided + ' decided');""",
    """  if (r.decisions_decided) parts.push(r.decisions_decided + ' decided');
  if (ideasRes && ideasRes.added) parts.push(ideasRes.added + (ideasRes.added === 1 ? ' content idea' : ' content ideas') + ' for the calendar' + (ideasRes.banked ? ' (' + ideasRes.banked + ' in the bank)' : ''));""")
rep("tasks_projected: projectedCount, jev:", "tasks_projected: projectedCount, content_ideas: ideasRes, jev:")

# the action
rep("""  const transcriptId = Number(body.transcript_id);
  if (!transcriptId) return json({ error: 'transcript_id required' }, 400);""",
    """  const transcriptId = Number(body.transcript_id);
  if (!transcriptId) return json({ error: 'transcript_id required' }, 400);
  if (body.action === 'ideas') {
    try { return json(await ideasOnly(transcriptId, body.dry_run === true)); } catch (e) { return json({ error: String((e as Error).message || e).slice(0, 300) }, 400); }
  }""")

open(P, 'w', encoding='utf-8').write(s)
if problems:
    print('PROBLEMS:'); [print('  ' + p) for p in problems]; sys.exit(1)
print('process-transcript v14 written')
