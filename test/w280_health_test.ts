/* w280_health_test.ts: health-check v3, the job watchdog, against a mock Supabase (REST and RPC) and a mock Slack.
   A job goes down: each admin gets one DM (two addresses on one Slack account get one), the channel gets a post, change_log has it;
   still down an hour later: nothing; a day later: a reminder; working again: one more DM. A first check that is fine says nothing.
   health_alert_to narrows the admins. The model checks of the daily run use the same path.
   usage: deno run -A test/w280_health_test.ts   (needs a deno.json with "nodeModulesDir": "auto" in the working directory) */
let pass = 0, fail = 0; const out: string[] = [];
// deno-lint-ignore no-explicit-any
function ok(name: string, cond: unknown, extra?: any) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 600) : '')); } }
// deno-lint-ignore no-explicit-any
type J = Record<string, any>;

const DB: Record<string, J[]> = {
  hub_roles: [{ email: 'steel.macdonald@welfareavenue.com', role: 'admin' }, { email: 'steelmacdonald@gmail.com', role: 'admin' }, { email: 'suhaib.abdillahi@welfareavenue.com', role: 'admin' }, { email: 'nobody@welfareavenue.com', role: 'admin' }, { email: 'tate@welfareavenue.com', role: 'member' }],
  wa_slack_ids: [{ email: 'steelmacdonald@gmail.com', slack_id: 'U_STEEL' }],
  app_config: [],
  wa_health_checks: [],
  change_log: [],
};
let JOBS: J[] = [];
const dms: J[] = []; const posts: J[] = [];
function rowsFor(table: string, u: URL): J[] {
  let rows = DB[table] || [];
  for (const [k, v] of u.searchParams) {
    if (['select', 'on_conflict', 'limit', 'order'].indexOf(k) >= 0) continue;
    const m = v.match(/^eq\.(.*)$/); if (m) rows = rows.filter((r) => String(r[k]) === decodeURIComponent(m[1]));
    const n = v.match(/^in\.\((.*)\)$/); if (n) rows = rows.filter((r) => n[1].split(',').map((x) => x.replace(/^"|"$/g, '')).indexOf(String(r[k])) >= 0);
  }
  return rows;
}
const server = Deno.serve({ port: 0, onListen: () => {} }, async (req) => {
  const u = new URL(req.url);
  const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
  if (u.pathname.startsWith('/slack/')) {
    const api = u.pathname.slice(7);
    if (api === 'users.lookupByEmail') { const e = u.searchParams.get('email'); return J(e === 'steel.macdonald@welfareavenue.com' ? { ok: true, user: { id: 'U_STEEL' } } : e === 'suhaib.abdillahi@welfareavenue.com' ? { ok: true, user: { id: 'U_SUHAIB' } } : { ok: false, error: 'users_not_found' }); }
    const b = await req.json();
    if (api === 'conversations.open') return J({ ok: true, channel: { id: 'D_' + b.users } });
    if (api === 'chat.postMessage') { dms.push({ to: b.channel, text: b.text }); return J({ ok: true }); }
    return J({ ok: false, error: 'unknown' });
  }
  if (u.pathname === '/webhook') { posts.push(await req.json()); return new Response('ok'); }
  const r = u.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/);
  if (r) {
    const args = await req.json().catch(() => ({}));
    if (r[1] === 'get_secret') return args.secret_name === 'SLACK_BOT_TOKEN' ? J('xoxb-test') : args.secret_name === 'SLACK_WEBHOOK_URL' ? J('http://127.0.0.1:' + server.addr.port + '/webhook') : args.secret_name === 'WA_TRIGGER_SECRET' ? J('trig') : J(null);
    if (r[1] === 'wa280_job_health') return J(JOBS);
    return J(null);
  }
  const t = u.pathname.match(/^\/rest\/v1\/(\w+)$/);
  if (t) {
    const table = t[1];
    if (req.method === 'GET') {
      const rows = rowsFor(table, u);
      if ((req.headers.get('accept') || '').indexOf('vnd.pgrst.object') >= 0) return rows.length === 1 ? J(rows[0]) : J({ code: 'PGRST116', message: 'no rows', details: '', hint: null }, 406);
      return J(rows);
    }
    if (req.method === 'POST') {
      const body = await req.json(); const list = Array.isArray(body) ? body : [body];
      const key = u.searchParams.get('on_conflict');
      for (const row of list) {
        const at = key ? (DB[table] ||= []).findIndex((x) => x[key] === row[key]) : -1;
        if (at >= 0) DB[table][at] = { ...DB[table][at], ...row }; else (DB[table] ||= []).push({ ...row });
      }
      return new Response(null, { status: 201 });
    }
    if (req.method === 'DELETE') return new Response(null, { status: 204 });
  }
  if (u.pathname === '/functions/v1/llm') return J({ ok: true, model: 'm', ms: 5 });
  return new Response('not found', { status: 404 });
});
Deno.env.set('WA_FN_TEST', '1');
Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:' + server.addr.port);
Deno.env.set('SUPABASE_ANON_KEY', 'anon');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service');
Deno.env.set('WA_SLACK_API', 'http://127.0.0.1:' + server.addr.port + '/slack');
const H = await import('../fn/health-check/index.ts');
const health = () => DB.wa_health_checks.find((x) => x.service === 'job:loom-pull') || {};
const call = (action?: string) => H.handler(new Request('http://x/', { method: 'POST', headers: { 'x-wa-secret': 'trig', 'Content-Type': 'application/json' }, body: JSON.stringify(action ? { action } : {}) }));

/* decide(): the state machine */
const T = Date.parse('2026-11-06T05:00:00Z');
const down: J = { service: 's', label: 'L', ok: false, error: 'e', since: '2026-10-26T23:00:00Z' };
ok('first check, fine: nothing', H.decide(null, { ...down, ok: true }, T).kind === null);
ok('first check, down: an alert, since the job says', JSON.stringify(H.decide(null, down, T)) === JSON.stringify({ kind: 'down', downSince: '2026-10-26T23:00:00Z' }));
ok('was fine, now down: an alert', H.decide({ ok: true }, down, T).kind === 'down');
ok('still down, alerted an hour ago: nothing, the start kept', JSON.stringify(H.decide({ ok: false, down_since: '2026-10-26T23:00:00Z', last_alert_at: new Date(T - 3600000).toISOString() }, { ...down, since: '2026-11-01T00:00:00Z' }, T)) === JSON.stringify({ kind: null, downSince: '2026-10-26T23:00:00Z' }));
ok('still down, alerted a day ago: a reminder', H.decide({ ok: false, down_since: 'x', last_alert_at: new Date(T - 24 * 3600000).toISOString() }, down, T).kind === 'again');
ok('was down, now fine: back up', H.decide({ ok: false }, { ...down, ok: true }, T).kind === 'up');
ok('the message says what, since when and the last error', /The Loom pull is not working\.\* Since .*Oct.*\nLast error: The Loom tools are not on this MCP server/.test(H.downText('The Loom pull', 'The Loom tools are not on this MCP server', '2026-10-26T23:00:00Z', false)) && /hub\.welfareavenue\.com/.test(H.downText('x', 'y', null, false)));

/* a whole hourly run: down */
JOBS = [{ service: 'job:loom-pull', label: 'The Loom pull (meetings into the Hub)', ok: false, error: 'The Loom tools are not on this MCP server (it has: listLoomObjects)', since: '2026-10-26T23:00:01Z' }, { service: 'fn:mail-pull', label: 'The scheduled job mail-pull', ok: true, error: null, since: null }];
let res = await (await call('jobs')).json();
ok('the run answers with the alert', JSON.stringify(res.jobs.alerts) === '["down job:loom-pull"]', res);
ok('one DM to Steel (two addresses, one Slack account) and one to Suhaib', dms.length === 2 && dms.some((d) => d.to === 'D_U_STEEL') && dms.some((d) => d.to === 'D_U_SUHAIB'), dms);
ok('the DM names the job and the error', /The Loom pull \(meetings into the Hub\) is not working/.test(dms[0]?.text) && /not on this MCP server/.test(dms[0]?.text), dms[0]);
ok('the channel gets the same post', posts.length === 1 && posts[0].text === dms[0].text);
ok('the state is kept with its start and the alert time', health().ok === false && health().down_since === '2026-10-26T23:00:01Z' && !!health().last_alert_at && health().label === 'The Loom pull (meetings into the Hub)', health());
const logged = DB.change_log.find((x) => x.entity_type === 'health' && x.entity_id === 'job:loom-pull');
ok('change_log: the alert and who got it', !!logged && /steelmacdonald@gmail\.com: skipped: same Slack account/.test(logged.new_value) && /nobody@welfareavenue\.com: skipped: no Slack account/.test(logged.new_value) && /channel: posted/.test(logged.new_value), logged);
ok('a member who is not an admin is not told', !/tate@/.test(logged?.new_value || ''));
ok('a job that is fine on its first check says nothing', DB.wa_health_checks.find((x) => x.service === 'fn:mail-pull')?.ok === true && dms.length === 2);

/* an hour later, still down: nothing */
res = await (await call('jobs')).json();
ok('still down an hour later: no DM', res.jobs.alerts.length === 0 && dms.length === 2, res);
/* a day later: a reminder */
health().last_alert_at = new Date(Date.now() - 25 * 3600000).toISOString();
res = await (await call('jobs')).json();
ok('a day later: the reminder', JSON.stringify(res.jobs.alerts) === '["again job:loom-pull"]' && dms.length === 4 && /Still not working: The Loom pull/.test(dms[3].text), dms.slice(2));
/* working again */
JOBS[0] = { ...JOBS[0], ok: true, error: null, since: null };
res = await (await call('jobs')).json();
ok('working again: one more DM each', JSON.stringify(res.jobs.alerts) === '["up job:loom-pull"]' && dms.length === 6 && /is working again\.\* It had stopped since/.test(dms[5].text), dms.slice(4));
ok('the state is fine again, the start cleared', health().ok === true && health().down_since === null && !!health().last_ok_at, health());

/* health_alert_to narrows the admins */
DB.app_config.push({ key: 'health_alert_to', value: 'suhaib.abdillahi@welfareavenue.com' });
ok('health_alert_to replaces the admin list', JSON.stringify(await H.alertTo()) === '["suhaib.abdillahi@welfareavenue.com"]');
DB.app_config.length = 0;
ok('without it, the admins (each address once)', (await H.alertTo()).length === 4);

/* the daily run: the models (fine) and the jobs */
res = await (await call()).json();
ok('daily run: models checked, no alert, jobs read too', res.ok && res.router_brain.ok && res.alerts.length === 0 && res.jobs.checked === 2, res);
ok('an unknown caller is refused', (await H.handler(new Request('http://x/', { method: 'POST', body: '{}' }))).status === 401);

await server.shutdown();
console.log(out.join('\n'));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) Deno.exit(1);
