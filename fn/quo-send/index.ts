// Welfare Avenue: quo-send (v2)
// v2: {{confirm_link}} placeholder. When the message contains it, every
// person recipient gets a personal confirmation link for the target event
// (the given event_id, else the next upcoming serving event). Missing
// roster rows are created (role from body.role or 'invited', status
// waiting) with a fresh token; the link opens the public confirm page on
// the dashboard. Raw-phone recipients with no person record are skipped
// for confirm_link sends and reported.
// v1: draft-and-confirm SMS through Quo (OpenPhone) from the Welfare Phone.
// {{first_name}} and {{event_date}} personalization, dedupe by phone,
// 200 cap, quo_messages logging.
import { createClient } from 'jsr:@supabase/supabase-js@2';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const FROM_NUMBER = '+14388087754';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body, status = 200)=>new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json'
    }
  });
async function getSecret(name) {
  const { data, error } = await svc.rpc('get_secret', {
    secret_name: name
  });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data;
}
async function siteUrl() {
  const { data } = await svc.from('app_config').select('value').eq('key', 'site_url').maybeSingle();
  return (data?.value || 'https://wa-exec-dashboard.netlify.app').replace(/\/$/, '') + '/';
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
      who: email
    };
  }
  return {
    ok: false,
    who: ''
  };
}
function normPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : '';
}
function firstName(full) {
  return String(full || '').trim().split(/\s+/)[0] || 'there';
}
function render(tmpl, vars) {
  return tmpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k)=>vars[k] ?? '');
}
function newToken() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 18);
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
  const message = String(body.message || '').trim();
  if (message.length < 5) return json({
    error: 'message required'
  }, 400);
  if (message.length > 1200) return json({
    error: 'message too long'
  }, 400);
  const dryRun = body.dry_run !== false;
  let eventId = Number.isInteger(body.event_id) ? body.event_id : null;
  const eventDate = String(body.event_date || '').trim();
  const audRole = typeof body.role === 'string' && body.role ? String(body.role).slice(0, 40) : null;
  const personIds = Array.isArray(body.person_ids) ? body.person_ids.filter((x)=>Number.isInteger(x)) : [];
  const rawPhones = Array.isArray(body.phones) ? body.phones.map(normPhone).filter(Boolean) : [];
  const recips = [];
  if (personIds.length) {
    const { data: people, error } = await svc.from('volunteer_people').select('id, full_name, phones').in('id', personIds.slice(0, 400));
    if (error) return json({
      error: 'could not load people'
    }, 500);
    for (const p of people || []){
      const ph = (p.phones || []).map(normPhone).filter(Boolean)[0];
      if (ph) recips.push({
        person_id: p.id,
        name: String(p.full_name || ''),
        phone: ph
      });
    }
  }
  for (const ph of rawPhones)recips.push({
    person_id: null,
    name: '',
    phone: ph
  });
  const seen = new Set();
  let finalRecips = recips.filter((r)=>{
    if (seen.has(r.phone)) return false;
    seen.add(r.phone);
    return true;
  });
  const skippedNoPhone = personIds.length - recips.filter((r)=>r.person_id !== null).length;
  // v2: personal confirmation links
  const needsLink = message.indexOf('{{confirm_link}}') >= 0;
  const linkByPhone = new Map();
  let skippedNoLink = 0;
  if (needsLink) {
    if (!eventId) {
      const { data: ev } = await svc.from('volunteer_events').select('id').eq('kind', 'service').neq('status', 'cancelled').gte('event_date', new Date().toISOString().slice(0, 10)).order('event_date', {
        ascending: true
      }).limit(1).maybeSingle();
      eventId = ev?.id ?? null;
    }
    if (!eventId) return json({
      error: 'confirm_link needs an upcoming event to attach to'
    }, 400);
    for (const r of finalRecips){
      if (!r.person_id) continue;
      const { data: row } = await svc.from('event_roster').select('id, confirm_token').eq('event_id', eventId).eq('person_id', r.person_id).maybeSingle();
      let token = row?.confirm_token || null;
      if (row && !token) {
        token = newToken();
        await svc.from('event_roster').update({
          confirm_token: token
        }).eq('id', row.id);
      }
      if (!row) {
        token = newToken();
        const { error: insErr } = await svc.from('event_roster').insert({
          event_id: eventId,
          person_id: r.person_id,
          person_name: r.name,
          role: audRole || 'invited',
          status: 'waiting',
          confirm_token: token,
          sort: 999
        });
        if (insErr) {
          console.error('roster insert failed', insErr);
          token = null;
        }
      }
      if (token) linkByPhone.set(r.phone, await siteUrl() + '#confirm/' + token);
    }
    const before = finalRecips.length;
    finalRecips = finalRecips.filter((r)=>linkByPhone.has(r.phone));
    skippedNoLink = before - finalRecips.length;
  }
  if (!finalRecips.length) return json({
    error: 'no reachable recipients'
  }, 400);
  if (finalRecips.length > 200) return json({
    error: 'batch too large (max 200)'
  }, 400);
  const batchId = crypto.randomUUID();
  const previews = [];
  let sent = 0, failed = 0;
  const key = dryRun ? '' : await getSecret('QUO_API_KEY');
  for (const r of finalRecips){
    const text = render(message, {
      first_name: firstName(r.name),
      event_date: eventDate,
      confirm_link: linkByPhone.get(r.phone) || ''
    });
    const to = '+1' + r.phone;
    let status = 'dry_run';
    let errMsg = null;
    if (!dryRun) {
      try {
        const res = await fetch('https://api.openphone.com/v1/messages', {
          method: 'POST',
          headers: {
            'Authorization': key,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: text,
            from: FROM_NUMBER,
            to: [
              to
            ]
          })
        });
        if (res.ok) {
          status = 'sent';
          sent += 1;
        } else {
          status = 'failed';
          failed += 1;
          errMsg = (res.status + ' ' + await res.text()).slice(0, 300);
        }
      } catch (e) {
        status = 'failed';
        failed += 1;
        errMsg = String(e.message || e).slice(0, 300);
      }
      await new Promise((res2)=>setTimeout(res2, 250));
    }
    await svc.from('quo_messages').insert({
      batch_id: batchId,
      person_id: r.person_id,
      phone: to,
      body: text,
      status,
      error: errMsg,
      event_id: eventId,
      sent_by: auth.who
    });
    if (previews.length < 60) previews.push({
      person_id: r.person_id,
      name: r.name,
      phone: to,
      text: text.slice(0, 300),
      status
    });
  }
  return json({
    batch_id: batchId,
    dry_run: dryRun,
    recipients: finalRecips.length,
    sent,
    failed,
    skipped_no_phone: Math.max(0, skippedNoPhone),
    skipped_no_link: skippedNoLink,
    previews
  });
});
