/* w280_fn_test.ts: loom-pull v5 against a mock of Atlassian's MCP server as it has been since 26/10/26 (listLoomObjects,
   getLoomObjectsContent, listLoomObjectFolders listed first, as the real one does) and a mock Supabase.
   Checks: the new tools are picked (never the folder tool), the list runs for MINE and SHARED_WITH_ME with a date range and at most
   25 a page, paging follows hasNextPage and nextOffset through a short and an empty page, a transcript in pages is joined (a line cut
   in two runs on), UNAVAILABLE is asked once more, a transcript still unavailable waits, no bare id is ever sent, and the run files.
   usage: deno run -A test/w280_fn_test.ts   (needs a deno.json with "nodeModulesDir": "auto" in the working directory) */
let pass = 0, fail = 0; const out: string[] = [];
// deno-lint-ignore no-explicit-any
function ok(name: string, cond: unknown, extra?: any) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 700) : '')); } }
// deno-lint-ignore no-explicit-any
type J = Record<string, any>;

const SITE = 'dfa46f34-4b09-4272-a345-c5d7967f4d56';
const hex = (n: number) => n.toString(16).padStart(32, '0');
const ari = (id: string) => 'ari:cloud:loom:' + SITE + ':video/activation/f82e5975/' + id;
const share = (id: string) => 'https://www.loom.com/share/' + id;
/* 27 of Steel's (hub@'s) recordings: two pages of 25 at most, the second short; one older than since; one shared with him */
const MINE: J[] = [];
for (let i = 1; i <= 27; i++) MINE.push({ ari: ari(hex(i)), type: 'MEETING_RECORDING', title: 'Weekly Operations Meeting - October ' + i + ', 2026', description: 'Summary ' + i, url: share(hex(i)), createdAt: new Date(Date.UTC(2026, 9, 30, 12) - i * 3600000).toISOString(), durationSeconds: 30, ownerAccountId: '712020:hub' });
MINE.push({ ari: ari(hex(99)), type: 'MEETING_RECORDING', title: 'Old meeting', url: share(hex(99)), createdAt: '2026-08-20T15:00:00.000Z', durationSeconds: 30 });
const SHARED: J[] = [{ ari: ari(hex(50)), type: 'MEETING_RECORDING', title: 'Weekly Fundraising Meeting - October 29, 2026', url: share(hex(50)), createdAt: '2026-10-29T23:00:00.000Z', durationSeconds: 30 }];
const PAGED = hex(1), RETRY = hex(2), NEVER = hex(3);
const LINE = (n: number) => '[0:' + String(n).padStart(2, '0') + '] ' + (n % 2 ? 'Eno Moffat' : 'Ahmed Fakhir') + ': We confirmed twelve volunteers for the Sunday serving, line ' + n + '.';
const TX: Record<string, string> = {};
for (const v of MINE.concat(SHARED)) TX[v.url.slice(-32)] = [1, 2, 3, 4].map(LINE).join('\n');
const PAGED_FULL = [1, 2, 3, 4, 5, 6].map(LINE).join('\n');
const cut1 = PAGED_FULL.indexOf('line 3') + 2;            // page 1 ends mid-line ("li")
const cut2 = PAGED_FULL.indexOf('\n[0:05]');              // page 2 ends at a line end, page 3 starts with a timed line
const PAGES = [PAGED_FULL.slice(0, cut1), PAGED_FULL.slice(cut1, cut2), PAGED_FULL.slice(cut2 + 1)];
let retryAsked = 0;

const S = { str: { type: 'string' } };
const TOOLS = [
  { name: 'atlassianUserInfo', inputSchema: { type: 'object', properties: {} } },
  { name: 'getAccessibleAtlassianResources', inputSchema: { type: 'object', properties: {} } },
  { name: 'getContentFormatGuide', inputSchema: { type: 'object', properties: {} } },
  { name: 'getLoomObjectsContent', inputSchema: { type: 'object', required: ['cloudId', 'identifiers'], properties: { cloudId: S.str, identifiers: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 10 },
    expand: { type: 'array', items: { type: 'string', enum: ['transcript', 'agentBrief', 'actionItems', 'comments', 'links', 'logs'] } }, resume: { type: 'array', items: { type: 'string' } } } } },
  { name: 'getLoomVideoDownloadUrl', inputSchema: { type: 'object', properties: { cloudId: S.str, videoAri: S.str, videoUrl: S.str } } },
  { name: 'listLoomObjectFolders', inputSchema: { type: 'object', required: ['cloudId'], properties: { cloudId: S.str, query: S.str } } },
  { name: 'listLoomObjects', inputSchema: { type: 'object', required: ['cloudId', 'scope'], properties: { cloudId: S.str, scope: { type: 'string', enum: ['MINE', 'SHARED_WITH_ME', 'ALL'] },
    artifactTypes: { type: 'array', items: { type: 'string', enum: ['ASYNC_VIDEO', 'MEETING_RECORDING'] } }, createdAtRange: { type: 'object', properties: { from: S.str, to: S.str } },
    sort: { type: 'string', enum: ['CREATED_DESC', 'CREATED_ASC'] }, limit: { type: 'integer', minimum: 1, maximum: 25, default: 10 }, offset: { type: 'integer', minimum: 0, default: 0 } } } },
];
const calls: J[] = []; const rpcs: J[] = []; const bad: string[] = [];
const mcpAnswer = (id: number, result: J, extraHeaders: Record<string, string> = {}) =>
  new Response('event: message\ndata: ' + JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n\n', { headers: { 'Content-Type': 'text/event-stream', ...extraHeaders } });
const text = (o: unknown) => ({ content: [{ type: 'text', text: JSON.stringify(o) }] });
const err = (m: string) => ({ isError: true, content: [{ type: 'text', text: m }] });
/* the real server's paging: offsets jump (a page can be short or empty while more remain) */
function listPage(rows: J[], a: J): J {
  const from = a.createdAtRange && a.createdAtRange.from ? Date.parse(a.createdAtRange.from) : 0;
  const keep = rows.filter((r) => Date.parse(r.createdAt) >= from);
  const off = Number(a.offset || 0), lim = Math.min(25, Number(a.limit || 10));
  if (off === 25) return { items: [], hasNextPage: true, nextOffset: 40 };          // an empty page while more remain
  const start = off === 40 ? 25 : off;
  const items = keep.slice(start, start + lim);
  const more = start + lim < keep.length;
  return { items, hasNextPage: more, ...(more ? { nextOffset: 25 } : {}) };
}
function contentItem(idf: string, a: J): J {
  const id = (idf.match(/([0-9a-f]{32})$/) || [])[1] || '';
  const v = MINE.concat(SHARED).find((x) => x.url.endsWith(id));
  if (!v) return { requestedIdentifier: idf, status: 'NOT_FOUND' };
  const base: J = { requestedIdentifier: idf, status: 'OK', ari: v.ari, type: v.type, title: v.title, description: v.description || '', url: v.url, createdAt: v.createdAt, durationSeconds: v.durationSeconds };
  const wantT = Array.isArray(a.expand) && a.expand.indexOf('transcript') >= 0;
  if (!wantT) return base;
  let comp: J;
  if (id === NEVER) comp = { component: 'transcript', status: 'UNAVAILABLE', reason: 'This component could not be read right now. Trying again may succeed.' };
  else if (id === RETRY && retryAsked++ === 0) comp = { component: 'transcript', status: 'UNAVAILABLE', reason: 'Trying again may succeed.' };
  else if (id === PAGED) {
    const r = Array.isArray(a.resume) ? String(a.resume[0] || '') : '';
    const i = r === 'c1' ? 1 : r === 'c2' ? 2 : 0;
    comp = { component: 'transcript', status: 'READY', payload: { content: PAGES[i], totalCharacters: PAGED_FULL.length, ...(i < 2 ? { nextCursor: 'c' + (i + 1) } : {}) } };
  } else comp = { component: 'transcript', status: 'READY', payload: { content: TX[id], totalCharacters: TX[id].length } };
  return { ...base, content: [comp] };
}
const server = Deno.serve({ port: 0, onListen: () => {} }, async (req) => {
  const u = new URL(req.url);
  if (u.pathname === '/mcp') {
    const m = await req.json();
    if (m.method === 'initialize') return mcpAnswer(m.id, { protocolVersion: '2025-06-18', serverInfo: { name: 'atlassian-mcp-server', version: '1.0.0' }, capabilities: { tools: {} } }, { 'Mcp-Session-Id': 's1' });
    if (m.method === 'notifications/initialized') return new Response(null, { status: 202 });
    if (m.method === 'tools/list') return mcpAnswer(m.id, { tools: TOOLS });
    if (m.method === 'tools/call') {
      const name = m.params.name; const a = m.params.arguments || {};
      calls.push({ name, a });
      if (name === 'getAccessibleAtlassianResources') return mcpAnswer(m.id, text({ data: [{ id: SITE, url: 'https://welfareavenue-29450069.atlassian.net', name: 'welfareavenue', scopes: ['read:loom:agent-interface'] }] }));
      if (!a.cloudId) return mcpAnswer(m.id, err('Input validation error: Required at cloudId'));
      if (name === 'listLoomObjectFolders') return mcpAnswer(m.id, text({ data: [{ id: 'f1', name: 'MaintainX' }] }));
      if (name === 'listLoomObjects') {
        if (['MINE', 'SHARED_WITH_ME', 'ALL'].indexOf(a.scope) < 0) return mcpAnswer(m.id, err('Input validation error: scope'));
        if (Number(a.limit) > 25) bad.push('limit ' + a.limit);
        return mcpAnswer(m.id, text({ data: listPage(a.scope === 'SHARED_WITH_ME' ? SHARED : MINE, a) }));
      }
      if (name === 'getLoomObjectsContent') {
        const ids: string[] = Array.isArray(a.identifiers) ? a.identifiers : [];
        if (!ids.length) return mcpAnswer(m.id, err('Input validation error: identifiers'));
        if (ids.some((x) => /^[0-9a-f]{32}$/i.test(x))) { bad.push('bare id ' + ids.join(',')); return mcpAnswer(m.id, err('Do not pass a bare video ID')); }
        return mcpAnswer(m.id, text({ data: { items: ids.map((x) => contentItem(x, a)) } }));
      }
      return mcpAnswer(m.id, err('unknown tool ' + name));
    }
    return new Response('?', { status: 400 });
  }
  const r = u.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/);
  const J = (o: unknown) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });
  if (r) {
    const args = await req.json().catch(() => ({}));
    rpcs.push({ fn: r[1], args });
    if (r[1] === 'get_secret') return new Response(JSON.stringify({ message: 'no' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    if (r[1] === 'loom_pull_context') return J({ since: '2026-09-02', max: 50, cloud_id: SITE, mcp_url: 'http://127.0.0.1:' + server.addr.port + '/mcp',
      roster: [{ name: 'Ahmed', department: 'opsmtl' }, { name: 'Eno Moffat', department: 'opsmtl' }, { name: 'Amanda', department: 'fundraising' }, { name: 'Steel', department: 'exec' }], leaders: ['Ahmed', 'Amanda'] });
    if (r[1] === 'loom_pull_known') return J({ videos: {}, archive: {} });
    if (r[1] === 'loom_file') return J({ transcript_id: 900 + rpcs.filter((x) => x.fn === 'loom_file').length, already: false });
    return J(null);
  }
  if (u.pathname.startsWith('/rest/v1/')) return J([]);
  return new Response('not found', { status: 404 });
});
Deno.env.set('WA_FN_TEST', '1');
Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:' + server.addr.port);
Deno.env.set('SUPABASE_ANON_KEY', 'anon');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service');
Deno.env.set('ATLASSIAN_EMAIL', 'hub@example.org');
Deno.env.set('ATLASSIAN_API_TOKEN', 'tok');
const F = await import('../fn/loom-pull/index.ts');

/* ---------------- the helpers ---------------- */
const listTool = TOOLS[6], getTool = TOOLS[3];
const la = F.argsFor(listTool, { cloudId: SITE, limit: 100, offset: 0, from: '2026-09-02T04:00:00.000Z' });
ok('list arguments: scope MINE by default, the date range, limit capped at 25', la.scope === 'MINE' && la.createdAtRange?.from === '2026-09-02T04:00:00.000Z' && la.limit === 25 && la.offset === 0 && !('createdAtFrom' in la), la);
ok('list arguments: SHARED_WITH_ME when asked', F.argsFor(listTool, { cloudId: SITE, scope: 'SHARED_WITH_ME' }).scope === 'SHARED_WITH_ME');
ok('list arguments: an unknown scope falls back to MINE', F.argsFor(listTool, { cloudId: SITE, scope: 'NOPE' }).scope === 'MINE');
const ga = F.argsFor(getTool, { cloudId: SITE, videoId: PAGED, ari: ari(PAGED), transcript: true, format: 'phrases' });
ok('content arguments: the ARI as an identifier, expand transcript only', JSON.stringify(ga.identifiers) === JSON.stringify([ari(PAGED)]) && JSON.stringify(ga.expand) === '["transcript"]' && !('videoId' in ga), ga);
const gu = F.argsFor(getTool, { cloudId: SITE, videoId: PAGED, transcript: true });
ok('content arguments without an ARI: the share link, never the bare id', JSON.stringify(gu.identifiers) === JSON.stringify([share(PAGED)]), gu);
ok('content arguments: resume passed as given', JSON.stringify(F.argsFor(getTool, { cloudId: SITE, videoId: PAGED, transcript: true, resume: ['c1'] }).resume) === '["c1"]');
ok('scopes of a list tool', F.scopeEnum(listTool).join(',') === 'MINE,SHARED_WITH_ME,ALL' && F.scopeEnum(TOOLS[5]).length === 0);
ok('page info: more and next offset', JSON.stringify(F.pageInfo({ data: { items: [], hasNextPage: true, nextOffset: 40 } })) === '{"more":true,"next":40}');
ok('page info: an answer that does not say', JSON.stringify(F.pageInfo({ data: { videos: [] } })) === '{"more":null,"next":null}');
ok('the transcript component', F.componentIn({ data: { items: [{ content: [{ component: 'transcript', status: 'READY', payload: { content: 'x' } }] }] } }, 'transcript')?.status === 'READY');
ok('no transcript component in an old answer', F.componentIn({ data: { video: {}, transcript: { text: 'x' } } }, 'transcript') === null);
ok('cursor of a component', F.componentCursor({ status: 'READY', payload: { content: 'x', nextCursor: 'abc' } }) === 'abc' && F.componentCursor({ status: 'READY', payload: {} }) === '');
ok('pages: a line cut in two runs on', F.joinPages('[0:01] A: hel', 'lo there') === '[0:01] A: hello there');
ok('pages: a new timed line starts its own line', F.joinPages('[0:01] A: hi', '[0:02] B: yo') === '[0:01] A: hi\n[0:02] B: yo');
ok('pages: a page ending in a new line is kept as it is', F.joinPages('[0:01] A: hi\n', '[0:02] B: yo') === '[0:01] A: hi\n[0:02] B: yo');
const tx = F.transcriptOf(PAGED_FULL);
ok('the [m:ss] Name: text lines Loom sends become the Hub\'s lines', tx.lines.length === 6 && tx.lines[0].startsWith('00:01 Eno Moffat: We confirmed') && tx.speakers.join(',') === 'Eno Moffat,Ahmed Fakhir', tx);

/* ---------------- a whole run ---------------- */
const res = await F.sync(1, 'Loom pull (scheduled)');
const names = calls.map((c) => c.name);
ok('the run is not an error', res.status === 'ok' || res.status === 'partial', res);
ok('the folder tool is never called', names.indexOf('listLoomObjectFolders') < 0, names);
const lists = calls.filter((c) => c.name === 'listLoomObjects');
ok('the list runs for MINE and for SHARED_WITH_ME', lists.some((c) => c.a.scope === 'MINE') && lists.some((c) => c.a.scope === 'SHARED_WITH_ME') && !lists.some((c) => c.a.scope === 'ALL'), lists.map((c) => c.a.scope));
ok('paging follows nextOffset through the empty page', JSON.stringify(lists.filter((c) => c.a.scope === 'MINE').map((c) => c.a.offset)) === '[0,25,40]', lists.map((c) => [c.a.scope, c.a.offset]));
ok('every list call has the date range', lists.every((c) => c.a.createdAtRange && c.a.createdAtRange.from === '2026-09-02T04:00:00.000Z'));
ok('no limit above 25 and no bare id sent', bad.length === 0, bad);
ok('all recordings since the start date are seen (27 + 1 shared), the old one is not', res.counts.seen === 28, res.counts);
const filed = rpcs.filter((x) => x.fn === 'loom_file').map((x) => x.args.p);
const pagedFile = filed.find((p) => p.loom_id === PAGED);
ok('the paged transcript is filed whole, the cut line joined', !!pagedFile && pagedFile.body.split('\n').length === 6 && /line 3\.$/.test(pagedFile.body.split('\n')[2]) && /line 6\.$/.test(pagedFile.body.split('\n')[5]), pagedFile && pagedFile.body);
const pagedCalls = calls.filter((c) => c.name === 'getLoomObjectsContent' && String(c.a.identifiers?.[0] || '').endsWith(PAGED));
ok('the transcript pages are asked with resume', JSON.stringify(pagedCalls.map((c) => (c.a.resume || [])[0] || '')) === '["","c1","c2"]', pagedCalls.map((c) => c.a.resume));
ok('UNAVAILABLE is asked once more, then filed', filed.some((p) => p.loom_id === RETRY) && calls.filter((c) => c.name === 'getLoomObjectsContent' && String(c.a.identifiers?.[0] || '').endsWith(RETRY)).length === 2);
const saves = rpcs.filter((x) => x.fn === 'loom_video_save').map((x) => x.args.p);
const never = saves.find((p) => p.loom_id === NEVER);
ok('a transcript still unavailable is not filed (it waits, or is left for an admin once it is old)', !filed.some((p) => p.loom_id === NEVER) && !!never && ['waiting', 'skipped'].indexOf(never.status) >= 0, never);
ok('the shared recording is filed too', filed.some((p) => p.loom_id === hex(50)));
ok('a filed meeting carries its title, date and team', !!pagedFile && pagedFile.title === MINE[0].title && pagedFile.department === 'opsmtl' && /^2026-10-/.test(pagedFile.meeting_date), pagedFile && { t: pagedFile.title, d: pagedFile.department, m: pagedFile.meeting_date });
ok('every filed meeting has a transcript body', filed.length >= 26 && filed.every((p) => String(p.body || '').length > 50), filed.length);

/* the probe reads the new tools without writing */
const pr = await F.probe() as J;
ok('probe: the new tools picked', pr.picked?.list === 'listLoomObjects' && pr.picked?.get === 'getLoomObjectsContent', pr.picked);

await server.shutdown();
console.log(out.join('\n'));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) Deno.exit(1);
