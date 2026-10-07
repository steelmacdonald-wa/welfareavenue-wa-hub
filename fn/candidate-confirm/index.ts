// Welfare Avenue: candidate-confirm (v3, 02/10/26)
// v3: an answer also covers the person's other open Recruitment rows (someone who applied for two roles gets one
//     text and one link; both cards move together, the second one noting which link answered).
// The JSON behind the "I'm still interested" page at hub.welfareavenue.com/i/<token>
// (site_files i/index.html, served by the _redirects rule). People who applied for a
// team role through CABM get that personal link by text. The token is
// <candidate id>.<signature>, an HMAC of the id with the project's service key,
// so a link cannot be guessed; cv-rehost's candidate_links action writes them
// (since wave210, recruit-actions interest_text makes them from the Applications board).
//   GET  ?t=<token>            {ok, first, role, lang, answered}   nothing is saved
//   POST {t, a: 'yes'|'no'}    a=yes: the candidate moves to Reviewing (Reviewing in
//                              HR centre > Recruitment means "confirmed still
//                              interested", so the HR team knows who to call), the
//                              summary gets a "Still interested" line, notes and
//                              change_log record it. a=no: Withdrawn, same trail.
//                              A second answer changes nothing ({answered: true}).
// Public (no sign-in): the token is the key. Only hub.welfareavenue.com may call it
// from a browser (CORS). Reads and writes hub_candidates and change_log with the
// service role. v1 served HTML pages, which the platform's domain refuses to render.
// (Copied into the repo on 06/10/26 from the deployed v3; the source had not been committed.)
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': 'https://hub.welfareavenue.com',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Vary': 'Origin',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function sign(id: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('candidate-confirm:' + SERVICE_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(id)));
  let s = '';
  for (const b of mac) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 20);
}
async function parseToken(t: string): Promise<number | null> {
  const m = /^(\d{1,12})\.([A-Za-z0-9_-]{20})$/.exec(String(t || '').trim());
  if (!m) return null;
  return (await sign(m[1])) === m[2] ? Number(m[1]) : null;
}
function firstName(full: string): string { return String(full || '').trim().split(/\s+/)[0] || ''; }
function whenEn(d: Date): string { return d.toLocaleDateString('en-CA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Toronto' }); }
function answered(summary: string): 'yes' | 'no' | '' {
  const s = String(summary || '');
  return s.startsWith('✅ Still interested') ? 'yes' : s.startsWith('❌ No longer interested') ? 'no' : '';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  let token = url.searchParams.get('t') || '';
  let a = '';
  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    token = String(body.t || token);
    a = String(body.a || '');
  } else if (req.method !== 'GET') {
    return json({ error: 'method' }, 405);
  }
  const id = await parseToken(token);
  if (!id) return json({ ok: false, error: 'bad_link' }, 404);
  const { data: c } = await svc.from('hub_candidates').select('id, name, role, status, summary, notes').eq('id', id).maybeSingle();
  if (!c) return json({ ok: false, error: 'bad_link' }, 404);

  const prior = answered(c.summary);
  if (req.method === 'GET') return json({ ok: true, first: firstName(c.name), role: c.role, status: c.status, answered: prior });
  if (a !== 'yes' && a !== 'no') return json({ ok: false, error: 'answer' }, 400);
  if (prior) return json({ ok: true, first: firstName(c.name), role: c.role, answer: prior, answered: prior, repeated: true });

  const now = new Date();
  const when = whenEn(now);
  const marker = a === 'yes' ? 'Still interested' : 'No longer interested';
  const line = a === 'yes'
    ? '✅ Still interested (confirmed ' + when + ' by text link).'
    : '❌ No longer interested (said so ' + when + ' by text link).';
  const status = a === 'yes' ? (['new', 'reviewing'].includes(String(c.status)) ? 'reviewing' : c.status) : 'withdrawn';
  const patch = {
    status, stage_at: now.toISOString(),
    summary: line + '\n\n' + String(c.summary || ''),
    notes: (String(c.notes || '') + '\n' + marker + ', ' + when + ' (text link).').trim(),
    updated_at: now.toISOString(), updated_by: 'candidate (text link)',
  };
  const { error } = await svc.from('hub_candidates').update(patch).eq('id', id);
  if (error) return json({ ok: false, error: 'save' }, 500);
  await svc.from('change_log').insert({ entity_type: 'candidate', entity_id: String(id), field: 'status', old_value: String(c.status), new_value: status + ' (' + marker.toLowerCase() + ', text link)', changed_by: 'candidate (text link)' });
  // v3: the same person's other open rows (a second role) follow the answer
  const { data: full } = await svc.from('hub_candidates').select('email').eq('id', id).maybeSingle();
  const email = String((full as { email?: string } | null)?.email || '').toLowerCase();
  if (email) {
    const { data: sibs } = await svc.from('hub_candidates').select('id, role, status, summary, notes').eq('email', email).neq('id', id).in('status', ['new', 'reviewing']);
    for (const s of (sibs || []) as Array<{ id: number; role: string; status: string; summary: string; notes: string }>) {
      if (answered(s.summary)) continue;
      const sLine = line.replace(' by text link)', ' by text link, the ' + c.role + ' link)');
      const sStatus = a === 'yes' ? 'reviewing' : 'withdrawn';
      await svc.from('hub_candidates').update({
        status: sStatus, stage_at: now.toISOString(), summary: sLine + '\n\n' + String(s.summary || ''),
        notes: (String(s.notes || '') + '\n' + marker + ', ' + when + ' (text link for ' + c.role + ').').trim(),
        updated_at: now.toISOString(), updated_by: 'candidate (text link)',
      }).eq('id', s.id);
      await svc.from('change_log').insert({ entity_type: 'candidate', entity_id: String(s.id), field: 'status', old_value: String(s.status), new_value: sStatus + ' (' + marker.toLowerCase() + ', text link for ' + c.role + ')', changed_by: 'candidate (text link)' });
    }
  }
  return json({ ok: true, first: firstName(c.name), role: c.role, answer: a, answered: a, repeated: false });
});
