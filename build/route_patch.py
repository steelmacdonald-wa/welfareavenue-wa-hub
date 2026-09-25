#!/usr/bin/env python3
"""Point an edge function's Anthropic call at the Hub router (llm).

  python3 build/route_patch.py <fn> <task> [<fn> <task> ...]

Rewrites `fetch('https://api.anthropic.com/v1/messages', {method, headers: {x-api-key...}}`
into a call to SUPABASE_URL + '/functions/v1/llm' with the service role key and
x-wa-task/x-wa-caller headers; the request body and the response parsing stay
as they are (the router speaks Anthropic Messages in and out)."""
import re, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FETCH = re.compile(r"fetch\(\s*'https://api\.anthropic\.com/v1/messages'\s*,\s*\{\s*method:\s*'POST'\s*,\s*headers:\s*\{[^}]*\}", re.S)


def patch(fn, task):
    p = os.path.join(ROOT, 'fn', fn, 'index.ts')
    s = open(p).read()
    if 'functions/v1/llm' in s:
        print(fn + ': already routed'); return True
    m = re.search(r"const\s+([A-Za-z_]+)\s*=\s*Deno\.env\.get\('SUPABASE_SERVICE_ROLE_KEY'\)", s)
    if not m:
        print(fn + ': no service key constant'); return False
    skey = m.group(1)
    if not re.search(r"const\s+SUPABASE_URL\s*=\s*Deno\.env\.get\('SUPABASE_URL'\)", s):
        print(fn + ': no SUPABASE_URL constant'); return False
    n = len(FETCH.findall(s))
    if n != 1:
        print(fn + ': expected one Anthropic call, found ' + str(n)); return False
    repl = ("fetch(SUPABASE_URL + '/functions/v1/llm', {\n      method: 'POST',\n      headers: {\n        'Authorization': 'Bearer ' + " + skey +
            ",\n        'x-wa-task': '" + task + "',\n        'x-wa-caller': '" + fn + "',\n        'Content-Type': 'application/json'\n      }")
    s = FETCH.sub(lambda _: repl, s, count=1)
    # the Anthropic key is no longer needed; keep the variable truthy so the old guards pass
    s, k = re.subn(r"await\s+getSecret\('ANTHROPIC_API_KEY'\)", "'hub-router'", s)
    note = "// Routed through the Hub model router (llm, task '" + task + "') on 25/09/26: OpenRouter picks the model per ai_routes; the request and response shapes are unchanged.\n"
    s = note + s
    open(p, 'w').write(s)
    print('%s: routed as %s (service key %s, %d key lookups replaced)' % (fn, task, skey, k))
    return True


if __name__ == '__main__':
    a = sys.argv[1:]
    pairs = list(zip(a[::2], a[1::2]))
    ok = all(patch(f, t) for f, t in pairs)
    sys.exit(0 if ok else 1)
