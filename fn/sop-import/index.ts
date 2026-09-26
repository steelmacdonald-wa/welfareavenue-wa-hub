// Welfare Avenue: sop-import (retired 26/09/26, audit)
// A one-off (27/07/26) that imported the Sunday serving SOP from ClickUp into sop_template and the
// event checklists. Running it again would overwrite edits made in the Hub since, and the live code
// carried a shared volunteer password (as a scrub pattern), so the function is retired: it answers 410.
// The original source is in the git history of this file (with the password redacted).
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
Deno.serve((req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  return new Response(JSON.stringify({ error: 'sop-import is retired (26/09/26). The serving SOP is edited in the Hub.' }), { status: 410, headers: { ...CORS, 'Content-Type': 'application/json' } });
});
