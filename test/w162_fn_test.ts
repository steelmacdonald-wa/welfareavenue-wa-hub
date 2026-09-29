/* w162_fn_test.ts: the loom-pull function against a mock Atlassian MCP server (streamable HTTP, server-sent events, a session
   id) and a mock Supabase (the RPCs the pull calls). Checks the pure helpers (results, ids, arguments, transcripts, deciding)
   and a whole sync run: what is filed and how, what waits for an admin, what is left out, and that no write tool is called.
   usage: deno run -A test/w162_fn_test.ts   (needs a deno.json with "nodeModulesDir": "auto" in the working directory) */
let pass = 0, fail = 0; const out: string[] = [];
// deno-lint-ignore no-explicit-any
function ok(name: string, cond: unknown, extra?: any) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra).slice(0, 700) : '')); } }
// deno-lint-ignore no-explicit-any
type J = Record<string, any>;

/* ---------------- the mock servers ---------------- */
const SITE = '0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b';
const hex = (n: number) => (n.toString(16).padStart(2, '0')).repeat(16);
const ari = (id: string) => 'ari:cloud:loom:' + SITE + ':video/activation/act123/' + id;
const V = {
  ops: hex(1), oneone: hex(2), board: hex(3), lead: hex(4), solo: hex(5), none: hex(6), personal: hex(7), sensitive: hex(8), known: hex(9), inArchive: hex(10), shared: hex(11), unclear: hex(12), privateTeam: hex(13), old: hex(14), vtt: hex(15),
};
const LIST: J[] = [
  { ari: ari(V.ops), name: 'Weekly Operations Meeting - September 22, 2026', description: '', createdAt: '2026-09-22T23:05:00.000Z' },
  { ari: ari(V.oneone), name: 'Ian x Robert 1on1', description: '', createdAt: '2026-09-21T15:00:00.000Z' },
  { ari: ari(V.board), name: 'Board Meeting - September 2026', createdAt: '2026-09-20T15:00:00.000Z' },
  { ari: ari(V.lead), name: 'Leadership Strategy & Discussion - September 14, 2026', createdAt: '2026-09-14T15:00:00.000Z' },
  { ari: ari(V.solo), name: 'Website walkthrough', createdAt: '2026-09-13T15:00:00.000Z' },
  { ari: ari(V.none), name: 'Marketing Meeting - September 26, 2026', createdAt: '2026-09-26T15:00:00.000Z' },
  { ari: ari(V.personal), name: 'Call', createdAt: '2026-09-12T15:00:00.000Z' },
  { ari: ari(V.sensitive), name: 'Human resources meeting - September 15, 2026', createdAt: '2026-09-15T15:00:00.000Z' },
  { ari: ari(V.known), name: 'Weekly Fundraising Meeting - September 8, 2026', createdAt: '2026-09-08T15:00:00.000Z' },
  { ari: ari(V.inArchive), name: 'Program Development Meeting - September 7, 2026', createdAt: '2026-09-07T15:00:00.000Z' },
  { ari: ari(V.unclear), name: 'Ahmed / Shima / Steel - September 10, 2026', createdAt: '2026-09-10T15:00:00.000Z' },
  { ari: ari(V.privateTeam), name: 'Marketing Meeting - September 16, 2026', createdAt: '2026-09-16T15:00:00.000Z' },
  { ari: ari(V.vtt), name: 'Toronto Operations Check-In', createdAt: '2026-09-18T15:00:00.000Z' },
];
const PH = (pairs: Array<[string, number, string]>) => pairs.map(([n, ms, t]) => ({ speaker: { name: n }, startTimeMs: ms, text: t }));
const VIDEOS: Record<string, J> = {
  [V.ops]: { video: { ari: ari(V.ops), name: LIST[0].name, createdAt: LIST[0].createdAt, duration: 3120, owner: { name: 'Steel MacDonald' }, privacy: 'workspace' },
    transcript: { phrases: PH([['Ahmed Fakhir', 0, 'Good evening everyone, let us start with the serving on Sunday.'], ['Eno Moffat', 16000, 'We have twelve volunteers confirmed for Sunday.'], ['Mary Dilusha Celestine', 44000, 'I will buy the vegetables on Saturday morning.'], ['Ahmed Fakhir', 3725000, 'Thanks all, see you Sunday.']]) } },
  [V.oneone]: { video: { ari: ari(V.oneone), name: LIST[1].name, createdAt: LIST[1].createdAt, owner: { name: 'Ian Odhiambo' }, privacy: 'workspace' },
    transcript: { text: '03:20 Ian Odhiambo: Hey Robert, how are you doing?\n03:26 Robert Smith: Doing well, thanks. I finished the reel drafts.\n03:40 Ian Odhiambo: Great, post them on Thursday.' } },
  [V.board]: { video: { name: LIST[2].name }, transcript: { phrases: PH([['Steel MacDonald', 0, 'Welcome to the board meeting.'], ['Suhaib Abdillahi', 5000, 'Thanks Steel, the budget is on track.']]) } },
  [V.lead]: { video: { name: LIST[3].name }, transcript: { phrases: PH([['Steel MacDonald', 0, 'Let us review the quarter.'], ['Ian Odhiambo', 5000, 'Marketing hit its goals.'], ['Amanda Zoldak', 9000, 'The gala is booked.']]) } },
  [V.solo]: { video: { name: LIST[4].name }, transcript: { phrases: PH([['Ian Odhiambo', 0, 'Here is how the new website menu works, I will click through it now.'], ['Ian Odhiambo', 9000, 'And this is the donate page.']]) } },
  [V.none]: { video: { name: LIST[5].name } },
  [V.personal]: { video: { name: 'Call' }, transcript: { phrases: PH([['Steel MacDonald', 0, 'I talked to my sponsor about the step work this week.'], ['Friend', 4000, 'How is your sobriety going? Ninety days sober is huge.']]) } },
  [V.sensitive]: { video: { name: LIST[7].name }, transcript: { phrases: PH([['Valex Sanon', 0, 'We need to talk about the disciplinary process for one volunteer lead.'], ['Tuna Kaynak', 4000, 'Understood.']]) } },
  [V.unclear]: { video: { name: LIST[10].name }, transcript: { phrases: PH([['Ahmed Fakhir', 0, 'Operations update.'], ['Shima Butera', 4000, 'Research update.'], ['Steel MacDonald', 8000, 'Thanks both.']]) } },
  [V.privateTeam]: { video: { name: LIST[11].name, privacy: 'owner_only' }, transcript: { phrases: PH([['Ian Odhiambo', 0, 'Marketing items.'], ['Kahkashan Ansary', 4000, 'Content calendar is ready.']]) } },
  [V.vtt]: { video: { name: LIST[12].name }, transcript: 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n<v Tamara Lee>Hi Toronto team, quick check-in.\n\n00:00:05.000 --> 00:00:09.000\n<v Joy Chen>The Scarborough serving is set for Sunday.\n' },
  [V.shared]: { video: { name: 'Partner catch-up', owner: { name: 'Pat Outsider' } }, transcript: { phrases: PH([['Pat Outsider', 0, 'Thanks for joining.'], ['Steel MacDonald', 3000, 'Happy to.']]) } },
};
const SHARED: J[] = [{ ari: ari(V.shared), name: 'Partner catch-up', createdAt: '2026-09-19T15:00:00.000Z', owner: { name: 'Pat Outsider' } }];
const S = { str: { type: 'string' }, int: { type: 'integer' } };
const LISTSCHEMA = { type: 'object', properties: { cloudId: S.str, limit: { type: 'integer', maximum: 100 }, offset: S.int, sortOrder: { type: 'string', enum: ['ASC', 'DESC'] }, createdAtFrom: S.str, createdAtTo: S.str }, required: ['cloudId'] };
const TOOLS = [
  { name: 'getAccessibleAtlassianResources', inputSchema: { type: 'object', properties: {} } },
  { name: 'atlassianUserInfo', inputSchema: { type: 'object', properties: {} } },
  { name: 'listLoomVideos', inputSchema: LISTSCHEMA },
  { name: 'listLoomVideosSharedWithMe', inputSchema: LISTSCHEMA },
  { name: 'getLoomVideo', inputSchema: { type: 'object', properties: { cloudId: S.str, videoAri: S.str, videoUrl: S.str, expand: { type: 'array', items: { type: 'string', enum: ['transcript', 'comments', 'agentBriefs', 'meetingActionItems', 'links'] } }, transcriptFormat: { type: 'string', enum: ['text', 'phrases', 'both'], default: 'text' }, commentsFirst: S.int }, required: ['cloudId'] } },
  { name: 'createLoomVideoComment', inputSchema: { type: 'object', properties: { cloudId: S.str, videoAri: S.str, content: S.str }, required: ['cloudId', 'content'] } },
  { name: 'updateLoomVideoPermissions', inputSchema: { type: 'object', properties: {} } },
];
const calls: J[] = []; const rpcs: J[] = []; let sessionOk = true; let listPages = 0;
const SECRETS: Record<string, string> = {};
const mcpAnswer = (id: number, result: J, sse: boolean, extraHeaders: Record<string, string> = {}) => {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, result });
  return sse
    ? new Response(': ping\n\nevent: message\ndata: ' + msg + '\n\n', { headers: { 'Content-Type': 'text/event-stream', ...extraHeaders } })
    : new Response(msg, { headers: { 'Content-Type': 'application/json', ...extraHeaders } });
};
const text = (o: unknown) => ({ content: [{ type: 'text', text: typeof o === 'string' ? o : JSON.stringify(o) }] });
let KNOWN: J = { videos: { [V.known]: { status: 'filed', attempts: 0 }, [V.none]: { status: 'waiting', attempts: 1 } }, archive: { [V.inArchive]: 7777 } };
const server = Deno.serve({ port: 0, onListen: () => {} }, async (req) => {
  const u = new URL(req.url);
  if (u.pathname === '/mcp') {
    const au = req.headers.get('authorization') || '';
    if (au !== 'Basic ' + btoa('steel@example.org:tok') && au !== 'Bearer at1') return new Response('no', { status: 401 });
    const m = await req.json();
    if (m.method === 'initialize') return mcpAnswer(m.id, { protocolVersion: '2025-06-18', serverInfo: { name: 'mock-atlassian', version: '1' }, capabilities: { tools: {} } }, true, { 'Mcp-Session-Id': 'sess-42' });
    if (req.headers.get('mcp-session-id') !== 'sess-42' || req.headers.get('mcp-protocol-version') !== '2025-06-18') { sessionOk = false; return new Response('missing session', { status: 400 }); }
    if (m.method === 'notifications/initialized') return new Response(null, { status: 202 });
    if (m.method === 'tools/list') return mcpAnswer(m.id, { tools: TOOLS }, false);
    if (m.method === 'tools/call') {
      const name = m.params.name; const a = m.params.arguments || {};
      calls.push({ name, a });
      if (name === 'getAccessibleAtlassianResources') return mcpAnswer(m.id, text({ data: { resources: [{ id: SITE, url: 'https://welfareavenue.atlassian.net', name: 'welfareavenue', scopes: ['read:loom:agent-interface'] }] } }), true);
      if (name === 'atlassianUserInfo') return mcpAnswer(m.id, text({ data: { accountId: '712020:x' } }), true);
      if (!a.cloudId) return mcpAnswer(m.id, { isError: true, ...text('Input validation error: Required at cloudId') }, true);
      if (name === 'listLoomVideos') {
        listPages++;
        const from = a.createdAtFrom ? Date.parse(a.createdAtFrom) : 0;
        const rows = LIST.concat([{ ari: ari(V.old), name: 'Old meeting', createdAt: '2026-08-20T15:00:00.000Z' }]).filter((r) => Date.parse(r.createdAt) >= from);
        const off = Number(a.offset || 0), lim = Number(a.limit || 25);
        return mcpAnswer(m.id, text({ data: { videos: rows.slice(off, off + lim), totalCount: rows.length } }), true);
      }
      if (name === 'listLoomVideosSharedWithMe') return mcpAnswer(m.id, text({ data: { videos: Number(a.offset || 0) ? [] : SHARED } }), true);
      if (name === 'getLoomVideo') {
        const id = String(a.videoAri || a.videoUrl || '').match(/([0-9a-f]{32})$/)?.[1] || '';
        const v = VIDEOS[id];
        if (!v) return mcpAnswer(m.id, { isError: true, ...text('Video not found') }, true);
        const wantT = Array.isArray(a.expand) && a.expand.indexOf('transcript') >= 0;
        const body: J = { data: { video: { ari: ari(id), ...v.video } } };
        if (wantT && v.transcript !== undefined) body.data.transcript = v.transcript;
        return mcpAnswer(m.id, text(body), true);
      }
      return mcpAnswer(m.id, { isError: true, ...text('unknown tool') }, true);
    }
    return new Response('?', { status: 400 });
  }
  const r = u.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/);
  if (r) {
    const args = await req.json().catch(() => ({}));
    rpcs.push({ fn: r[1], args });
    const J = (o: unknown) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });
    if (r[1] === 'get_secret') return SECRETS[args.secret_name] ? J(SECRETS[args.secret_name]) : new Response(JSON.stringify({ message: 'no' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    if (r[1] === 'wa_vault_set') { SECRETS[args.p_name] = args.p_value; return J(null); }
    if (r[1] === 'loom_pull_context') return J({ since: '2026-09-02', max: 20, cloud_id: '', mcp_url: 'http://127.0.0.1:' + server.addr.port + '/mcp',
      roster: [{ name: 'Ahmed', department: 'opsmtl' }, { name: 'Eno Moffat', department: 'opsmtl' }, { name: 'Mary', department: 'opsmtl' }, { name: 'Ian', department: 'marketing' }, { name: 'Robert', department: 'marketing' },
        { name: 'Steel', department: 'exec' }, { name: 'Suhaib', department: 'exec' }, { name: 'Amanda', department: 'fundraising' }, { name: 'Shima', department: 'progdev' }, { name: 'Kahkashan', department: 'marketing' },
        { name: 'Valex', department: 'hr' }, { name: 'Tuna', department: 'hr' }, { name: 'Ibrahim Awad', department: 'opsmtl' }, { name: 'Tamara', department: 'opsto' }, { name: 'Joy', department: 'opsto' }],
      leaders: ['Ahmed', 'Amanda', 'Kahkashan', 'Shima'] });
    if (r[1] === 'loom_pull_known') return J(KNOWN);
    if (r[1] === 'loom_file') return J({ transcript_id: 900 + rpcs.filter((x) => x.fn === 'loom_file').length, already: false });
    return J(null);
  }
  return new Response('not found', { status: 404 });
});
const port = server.addr.port;
Deno.env.set('WA_FN_TEST', '1');
Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:' + port);
Deno.env.set('SUPABASE_ANON_KEY', 'anon');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service');
Deno.env.set('ATLASSIAN_EMAIL', 'steel@example.org');
Deno.env.set('ATLASSIAN_API_TOKEN', 'tok');
const F = await import('../fn/loom-pull/index.ts');

/* ---------------- the helpers ---------------- */
ok('SSE: the message with the right id', F.pickMessage('event: message\ndata: {"jsonrpc":"2.0","id":3,"result":{"a":1}}\n\n', 'text/event-stream', 3)?.result?.a === 1);
ok('SSE: comments and several events', F.sseMessages(': hi\n\ndata: {"id":1}\n\nevent: message\ndata: {"id":2,\ndata: "result":{}}\n\n').length === 2);
ok('JSON answer', F.pickMessage('{"jsonrpc":"2.0","id":1,"result":{"x":2}}', 'application/json', 1)?.result?.x === 2);
ok('read tools allowed', ['getLoomVideo', 'listLoomVideos', 'listLoomVideosSharedWithMe', 'getAccessibleAtlassianResources', 'atlassianUserInfo', 'listLoomFolders'].every(F.readOnlyTool));
ok('write tools refused', ['createLoomVideoComment', 'updateLoomVideoPermissions', 'shareLoomVideo', 'moveLoomVideoToFolder', 'updateLoomVideoTitle', 'recoverLoomVideo', 'publishLoomVideo', 'createLoomFolder', 'getAndDeleteThing', 'listAndShare'].every((n) => !F.readOnlyTool(n)));
ok('tool result: JSON text', (F.toolData(text({ a: 1 })) as J).a === 1);
ok('tool result: structured content first', (F.toolData({ structuredContent: { b: 2 }, content: [] }) as J).b === 2);
let threw = ''; try { F.toolData({ isError: true, ...text('Input validation error') }); } catch (e) { threw = String((e as Error).message); }
ok('tool result: an error is raised with its text', /Input validation error/.test(threw), threw);
ok('Loom id from an ARI', F.loomIdOf({ ari: ari(V.ops) }) === V.ops);
ok('Loom id from a share link', F.loomIdOf({ url: 'https://www.loom.com/share/' + V.oneone + '?sid=x' }) === V.oneone);
ok('Loom id from a hex id', F.loomIdOf({ id: V.board.toUpperCase() }) === V.board);
ok('videos found in a nested answer', F.videosIn({ data: { videos: LIST.slice(0, 3) } }).length === 3);
ok('sites from getAccessibleAtlassianResources', F.sitesIn({ data: { resources: [{ id: SITE, url: 'https://x.atlassian.net', name: 'x' }] } })[0]?.id === SITE);
ok('no sites when the list is empty', F.sitesIn({ data: { resources: [] } }).length === 0);
const la = F.argsFor(TOOLS[2], { cloudId: SITE, limit: 500, offset: 100, from: '2026-09-02T04:00:00.000Z' });
ok('list arguments: cloudId, limit capped at the maximum, offset, created from', la.cloudId === SITE && la.limit === 100 && la.offset === 100 && la.createdAtFrom === '2026-09-02T04:00:00.000Z', la);
const ga = F.argsFor(TOOLS[4], { cloudId: SITE, videoId: V.ops, ari: ari(V.ops), transcript: true, format: 'phrases' });
ok('video arguments: the ARI, expand transcript only, phrases', ga.videoAri === ari(V.ops) && JSON.stringify(ga.expand) === '["transcript"]' && ga.transcriptFormat === 'phrases' && !ga.videoUrl, ga);
const gu = F.argsFor(TOOLS[4], { cloudId: SITE, videoId: V.ops, transcript: true, format: 'phrases' });
ok('video arguments without an ARI: the share link', gu.videoUrl === 'https://www.loom.com/share/' + V.ops, gu);
ok('since as a UTC time', F.sinceIso('2026-09-02') === '2026-09-02T04:00:00.000Z');

/* transcripts */
const t1 = F.transcriptOf({ data: { transcript: { phrases: PH([['Ahmed Fakhir', 0, 'Hello'], ['Eno Moffat', 16000, 'Hi'], ['Ahmed Fakhir', 3725000, 'Bye']]) } } });
ok('phrases with milliseconds', t1.lines.join('|') === '00:00 Ahmed Fakhir: Hello|00:16 Eno Moffat: Hi|1:02:05 Ahmed Fakhir: Bye' && t1.speakers.join(',') === 'Ahmed Fakhir,Eno Moffat', t1);
const t2 = F.transcriptOf({ data: { transcript: { text: '03:20 Ian Odhiambo: Hey\n03:26 Robert Smith: Hi there\n03:40 Ian Odhiambo: Great' } } });
ok('text lines kept as they are', t2.lines[0] === '03:20 Ian Odhiambo: Hey' && t2.speakers.length === 2, t2);
const t3 = F.transcriptOf({ transcript: 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n<v Tamara Lee>Hi team\n\n00:01:05.500 --> 00:01:09.000\n<v Joy Chen>Sunday is set\n' });
ok('WebVTT with voices', t3.lines.join('|') === '00:01 Tamara Lee: Hi team|01:05 Joy Chen: Sunday is set', t3);
const t4 = F.transcriptOf({ phrases: [{ speaker: 'Speaker 1', start: 0, text: 'one' }, { speaker: 'Speaker 2', start: 2.5, text: 'two' }] });
ok('unnamed speakers are not names', t4.speakers.length === 0 && t4.lines[0] === '00:00 one', t4);
const words = Array.from({ length: 60 }, (_, i) => ({ speakerName: i < 30 ? 'Ian Odhiambo' : 'Robert Smith', start: i, text: 'w' + i }));
const t5 = F.transcriptOf({ segments: words });
ok('word by word pieces are joined per speaker', t5.lines.length === 2 && /^00:00 Ian Odhiambo: w0 w1/.test(t5.lines[0]) && /^00:30 Robert Smith: w30/.test(t5.lines[1]), t5.lines.map((l: string) => l.slice(0, 40)));
ok('no transcript, no lines', F.transcriptOf({ data: { video: { name: 'x' } } }).lines.length === 0);
const t6 = F.transcriptOf('# Video\nSome meeting\n\n## Transcript\n0:05 Ian Odhiambo: Hello there\n0:09 Robert Smith: Hi\n');
ok('a markdown answer with a Transcript section', t6.lines.length === 2 && t6.lines[0] === '00:05 Ian Odhiambo: Hello there', t6);

/* roster matching */
const R = [{ name: 'Ian', department: 'marketing' }, { name: 'Ibrahim Awad', department: 'opsmtl' }, { name: 'Eno Moffat', department: 'opsmtl' }, { name: 'Mary', department: 'opsmtl' }, { name: 'Robert', department: 'marketing' }];
ok('first name on the roster matches a full name', F.matchRoster('Ian Odhiambo', R)?.name === 'Ian');
ok('a different surname does not match a full roster name', F.matchRoster('Ibrahim Saoud', R) === null);
ok('exact full name matches', F.matchRoster('Eno Moffat', R)?.name === 'Eno Moffat');
ok('a nickname does not match', F.matchRoster('Roberto Toto', R) === null);

/* deciding */
const CTX = { roster: R.concat([{ name: 'Ahmed', department: 'opsmtl' }, { name: 'Shima', department: 'progdev' }, { name: 'Steel', department: 'exec' }, { name: 'Kahkashan', department: 'marketing' }, { name: 'Amanda', department: 'fundraising' }]), leaders: ['Ahmed', 'Amanda', 'Kahkashan', 'Shima'] };
const vid = (title: string, extra: J = {}) => ({ ...F.normVideo({ ari: ari(V.ops), name: title }), ...extra });
const tx = (names: string[], body = 'hello there') => ({ lines: names.map((n, i) => '00:0' + i + ' ' + n + ': ' + body), speakers: names });
const d1 = F.classify(vid('Weekly Operations Meeting - September 22, 2026'), tx(['Ahmed Fakhir', 'Eno Moffat']), CTX, 1, 0);
ok('a weekly team meeting: everyone, its team', d1.status === 'filed' && d1.department === 'opsmtl' && d1.visibility === null, d1);
const d2 = F.classify(vid('Ian x Robert 1on1'), tx(['Ian Odhiambo', 'Robert Smith']), CTX, 1, 0);
ok('a one-on-one: confidential to the people in it and the leaders', d2.status === 'filed' && d2.visibility === 'private' && d2.department === 'marketing' && JSON.stringify(d2.allowed) === JSON.stringify(['Ahmed', 'Amanda', 'Ian', 'Kahkashan', 'Robert', 'Shima']), d2);
ok('a leadership meeting: leaders only', (() => { const d = F.classify(vid('Leadership Strategy & Discussion'), tx(['Steel MacDonald', 'Ian Odhiambo']), CTX, 1, 0); return d.status === 'filed' && d.department === 'Leadership meeting' && d.visibility === 'leadership'; })());
ok('a board meeting waits for an admin', F.classify(vid('Board Meeting - September 2026'), tx(['Steel MacDonald', 'Suhaib Abdillahi']), CTX, 1, 0).status === 'needs_look');
ok('onboarding is not a board meeting', F.classify(vid('Eno Onboarding Setup'), tx(['Valex Sanon', 'Eno Moffat']), CTX, 1, 0).department === 'hr');
ok('one person speaking is skipped', F.classify(vid('Website walkthrough'), tx(['Ian Odhiambo']), CTX, 1, 0).status === 'skipped');
ok('a Loom meeting recording with one speaker is skipped too', F.classify(vid('Quick sync', { meeting: true }), tx(['Ian Odhiambo']), CTX, 1, 0).status === 'skipped');
ok('but a team meeting with one speaker is still filed', F.classify(vid('Marketing Meeting - September 30'), tx(['Ian Odhiambo']), CTX, 1, 0).status === 'filed');
ok('no transcript yet: waiting, then skipped after five days', F.classify(vid('Marketing Meeting'), { lines: [], speakers: [] }, CTX, 1, 0).status === 'waiting' && F.classify(vid('Marketing Meeting'), { lines: [], speakers: [] }, CTX, 6, 3).status === 'skipped');
ok('a personal title is left out', F.classify(vid('Sponsor call'), tx(['A', 'B']), CTX, 1, 0).status === 'personal');
ok('a personal transcript is left out (two signs)', F.classify(vid('Call'), tx(['A', 'B'], 'my sponsor said the big book helps'), CTX, 1, 0).status === 'personal');
ok('one passing word is not personal', F.classify(vid('Fundraising Meeting'), tx(['Amanda Zoldak', 'Rami'], 'our sponsor for the gala'), CTX, 1, 0).status === 'filed');
ok('sensitive words wait for an admin', F.classify(vid('Human resources meeting'), tx(['Valex Sanon', 'Tuna Kaynak'], 'the disciplinary process'), CTX, 1, 0).status === 'needs_look');
ok('a role changing hands waits for an admin, without saying so', (() => { const d = F.classify(vid('Ahmed / Steel'), tx(['Ahmed Fakhir', 'Steel MacDonald'], 'when I step back from the role'), CTX, 1, 0); return d.status === 'needs_look' && !/role|transition|step/i.test(d.reason); })());
ok('a team is unclear: waits for an admin', F.classify(vid('Ahmed / Shima / Steel'), tx(['Ahmed Fakhir', 'Shima Butera', 'Steel MacDonald']), CTX, 1, 0).status === 'needs_look');
ok('a team meeting Loom keeps to its owner (the default) is still for everyone', (() => { const d = F.classify(vid('Marketing Meeting - September 16', { privacy: 'OWNER' }), tx(['Ian Odhiambo', 'Kahkashan Ansary']), CTX, 1, 0); return d.status === 'filed' && d.visibility === null && d.department === 'marketing'; })());
ok('invitees by email join the people in a confidential meeting', (() => { const R2 = CTX.roster.concat([{ name: 'Tuna', email: 'tuna.kaynak@welfareavenue.com', department: 'hr' }]); const d = F.classify(vid('Valex / Natasha 1on1', { participants: ['tuna.kaynak@welfareavenue.com', 'kansary@outlook.com'] }), tx(['Valex Sanon', 'Natasha Lee']), { roster: R2, leaders: CTX.leaders }, 1, 0); return d.status === 'filed' && d.visibility === 'private' && d.department === 'hr' && (d.allowed || []).indexOf('Tuna') >= 0; })());
ok('a Loom answer shaped like the real one (data.transcriptPhrases, speakerName, ts, value)', (() => { const t = F.transcriptOf({ data: { id: ari(V.ops), isMeeting: true, transcriptPhrases: [{ speakerName: 'Ian Odhiambo', ts: 0.016, value: 'Hello there. ' }, { speakerName: 'Patricia Kamara', ts: 7.115, value: 'Hi Ian. ' }, { speakerName: 'Ian Odhiambo', ts: 3725.2, value: 'Bye.' }] } }); return t.lines.join('|') === '00:00 Ian Odhiambo: Hello there.|00:07 Patricia Kamara: Hi Ian.|1:02:05 Ian Odhiambo: Bye.' && t.speakers.length === 2; })());
ok('the real video metadata: date, length, meeting, invitees', (() => { const v = F.normVideo({ id: ari(V.ops), name: 'Marketing Meeting', visibility: 'OWNER', url: 'https://www.loom.com/share/' + V.ops, isMeeting: true, collaborators: ['ian.odhiambo@welfareavenue.com'], sourceDuration: 2936.003, createdAt: '2026-09-09T22:15:35.325Z' }); return v.id === V.ops && v.duration_s === 2936 && v.meeting && v.participants[0] === 'ian.odhiambo@welfareavenue.com' && v.created === '2026-09-09T22:15:35.325Z' && v.privacy === 'OWNER'; })());
ok('shared by someone outside: waits', F.classify(vid('Partner catch-up', { shared: true, owner: 'Pat Outsider' }), tx(['Pat Outsider', 'Steel MacDonald']), CTX, 1, 0).status === 'needs_look');

/* ---------------- a whole run ---------------- */
const res = await F.sync(1, 'Loom pull (scheduled)');
ok('the session id and protocol version were sent on every call', sessionOk);
ok('no write tool was called', calls.every((c) => F.readOnlyTool(c.name)), calls.map((c) => c.name));
ok('the site was found and passed as cloudId', calls.filter((c) => c.name !== 'getAccessibleAtlassianResources' && c.name !== 'atlassianUserInfo').every((c) => c.a.cloudId === SITE));
ok('the list asked from loom_pull_since', calls.filter((c) => c.name === 'listLoomVideos').every((c) => c.a.createdAtFrom === '2026-09-02T04:00:00.000Z'));
const filed = rpcs.filter((x) => x.fn === 'loom_file').map((x) => x.args.p);
const saved = rpcs.filter((x) => x.fn === 'loom_video_save').map((x) => x.args.p);
const byId = (id: string) => filed.find((p: J) => p.loom_id === id) || saved.find((p: J) => p.loom_id === id);
ok('the run ended ok', res.status === 'ok', res);
ok('seen: the owned and shared recordings since the start date', res.counts.seen === LIST.length + 1, res.counts);
ok('the weekly Operations meeting is filed for everyone under opsmtl', byId(V.ops)?.department === 'opsmtl' && byId(V.ops)?.visibility === 'department' && byId(V.ops)?.body.split('\n')[0] === '00:00 Ahmed Fakhir: Good evening everyone, let us start with the serving on Sunday.', byId(V.ops));
ok('its date is the Toronto date, its title the Loom name', byId(V.ops)?.meeting_date === '2026-09-22' && byId(V.ops)?.title === LIST[0].name && byId(V.ops)?.added_by === 'Loom pull (scheduled)');
ok('the one-on-one is confidential with its people and the leaders', byId(V.oneone)?.visibility === 'private' && JSON.stringify(byId(V.oneone)?.allowed_people) === JSON.stringify(['Ahmed', 'Amanda', 'Ian', 'Kahkashan', 'Robert', 'Shima']), byId(V.oneone));
ok('the leadership meeting is for the leaders', byId(V.lead)?.department === 'Leadership meeting' && byId(V.lead)?.visibility === 'leadership');
ok('the Toronto check-in (WebVTT) is filed under opsto', byId(V.vtt)?.department === 'opsto' && /^00:01 Tamara Lee: /.test(byId(V.vtt)?.body || ''), byId(V.vtt));
ok('the board meeting needs a look', byId(V.board)?.status === 'needs_look');
ok('the solo walkthrough is skipped', byId(V.solo)?.status === 'skipped');
ok('the meeting without a transcript waits (tried again)', byId(V.none)?.status === 'waiting');
ok('the personal recording is left out, with no title', byId(V.personal)?.status === 'personal');
ok('the sensitive HR meeting needs a look', byId(V.sensitive)?.status === 'needs_look');
ok('the unclear meeting needs a look', byId(V.unclear)?.status === 'needs_look');
ok('a team meeting Loom keeps to its owner is filed for everyone', byId(V.privateTeam)?.visibility === 'department');
ok('the shared recording from outside needs a look', byId(V.shared)?.status === 'needs_look');
ok('a filed one is not read again', !calls.some((c) => c.name === 'getLoomVideo' && String(c.a.videoAri || '').endsWith(V.known)) && !byId(V.known));
ok('one already in the archive is marked, not filed', rpcs.some((x) => x.fn === 'loom_file_seen' && x.args.p_loom_id === V.inArchive && x.args.p_transcript_id === 7777) && !filed.some((p: J) => p.loom_id === V.inArchive));
ok('nothing from before the start date', !byId(V.old));
ok('oldest first', filed.map((p: J) => p.loom_id).indexOf(V.lead) < filed.map((p: J) => p.loom_id).indexOf(V.ops));
ok('the counts add up', res.counts.filed === 5 && res.counts.needs_look === 4 && res.counts.waiting === 1 && res.counts.skipped === 2 && res.counts.errors === 0, res.counts);

/* the per-run limit */
rpcs.length = 0; calls.length = 0;
KNOWN = { videos: {}, archive: {} };
const origFetch = globalThis.fetch;
const res2 = await (async () => { const r = await F.sync(2, 'Loom pull (scheduled)'); return r; })();
ok('with nothing known, everything is looked at (max 20); two Loom cannot open are errors', res2.counts.errors === 2 && res2.counts.filed + res2.counts.needs_look + res2.counts.waiting + res2.counts.skipped === LIST.length + 1 - 2, res2.counts);
globalThis.fetch = origFetch;

/* a refused key */
Deno.env.set('ATLASSIAN_API_TOKEN', 'wrong');
const res3 = await F.sync(3, 'Loom pull (scheduled)');
ok('a refused key ends the run as refused', res3.status === 'refused' && /refused/i.test(res3.note), res3);
Deno.env.set('ATLASSIAN_API_TOKEN', '');
const res4 = await F.sync(4, 'Loom pull (scheduled)');
ok('no key and no connection: the run says Loom is not connected yet', res4.status === 'no_key' && /Loom is not connected yet: an admin presses Connect Loom/.test(res4.note), res4);

/* wave162c: the connection through Atlassian's approval comes first */
const realFetch = globalThis.fetch; const tokenCalls: J[] = []; let tokenReply: J = { access_token: 'at1', refresh_token: 'r2', expires_in: 3600 }; let tokenStatus = 200;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const u = String(input instanceof Request ? input.url : input);
  if (u === 'https://auth.atlassian.com/oauth/token') { tokenCalls.push(Object.fromEntries(new URLSearchParams(String(init?.body || '')))); return new Response(JSON.stringify(tokenReply), { status: tokenStatus, headers: { 'Content-Type': 'application/json' } }); }
  return realFetch(input as RequestInfo, init);
}) as typeof fetch;
SECRETS.LOOM_OAUTH_REFRESH = 'r1'; SECRETS.LOOM_OAUTH_CLIENT = JSON.stringify({ client_id: 'cid' });
rpcs.length = 0; calls.length = 0; KNOWN = { videos: {}, archive: {} };
const res5 = await F.sync(5, 'Loom pull (scheduled)');
ok('with a connection the pull renews the access token with the refresh token and client id', tokenCalls.length === 1 && tokenCalls[0].grant_type === 'refresh_token' && tokenCalls[0].refresh_token === 'r1' && tokenCalls[0].client_id === 'cid' && tokenCalls[0].resource === 'https://mcp.atlassian.com/v2/mcp', tokenCalls);
ok('keeps the new refresh token and the access token, and reads Loom with it', SECRETS.LOOM_OAUTH_REFRESH === 'r2' && JSON.parse(SECRETS.LOOM_OAUTH_ACCESS || '{}').t === 'at1' && res5.counts.seen > 0 && res5.status !== 'refused', [SECRETS.LOOM_OAUTH_REFRESH, res5.status, res5.counts]);
rpcs.length = 0;
const res6 = await F.sync(6, 'Loom pull (scheduled)');
ok('a fresh access token is used again without renewing', tokenCalls.length === 1 && res6.counts.seen > 0, [tokenCalls.length, res6.counts]);
SECRETS.LOOM_OAUTH_ACCESS = JSON.stringify({ t: 'at1', exp: Date.now() + 30000 }); tokenReply = { error: 'invalid_grant', error_description: 'Unknown or invalid refresh token.' }; tokenStatus = 403;
const res7 = await F.sync(7, 'Loom pull (scheduled)');
ok('a lapsed connection ends the run as refused and says to press Connect Loom', res7.status === 'refused' && /The Loom connection has lapsed \(Unknown or invalid refresh token\.\): an admin presses Connect Loom/.test(res7.note), res7);
globalThis.fetch = realFetch;

/* wave162c v2 (29/09/26): Atlassian's sign-in step after Accept answers "invalid_request: Incorrect request parameters" unless the
   approval asks for the email scope too; the approval stays read-only (no write, search, delete or manage scope) */
const connectSrc = await Deno.readTextFile(new URL('../fn/loom-connect/index.ts', import.meta.url));
const scopeLine = (connectSrc.match(/const SCOPE = '([^']*)'/) || [])[1] || '';
const scopes = scopeLine.split(/\s+/);
ok('Connect Loom asks for email with read Loom, read:me, read:account and offline access', ['read:loom:agent-interface', 'read:me', 'read:account', 'email', 'offline_access'].every((s) => scopes.indexOf(s) >= 0), scopeLine);
ok('Connect Loom asks for nothing that writes, searches, deletes or manages', scopes.length === 5 && !scopes.some((s) => /^(write|search|delete|manage):/.test(s)), scopeLine);
ok('the client metadata document asks for the same scopes', new RegExp("scope: '" + scopeLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'").test(connectSrc), scopeLine);

await server.shutdown();
console.log(out.join('\n'));
console.log('\nw162_fn_test: ' + pass + ' passed, ' + fail + ' failed');
Deno.exit(fail ? 1 : 0);
